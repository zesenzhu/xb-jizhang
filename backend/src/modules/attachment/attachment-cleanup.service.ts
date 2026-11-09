import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ATTACHMENT_CLEANUP_INTERVAL_SECONDS } from './attachment.constants';
import { OBJECT_STORAGE, type ObjectStoragePort } from './object-storage/object-storage.port';

const BATCH_SIZE = 100;

/**
 * 只处理数据库已标记可见性变化的附件：
 * - 过期 PENDING：对象可能已上传但未确认，删除对象并标记 DELETED；
 * - DELETED 且未 purgedAt：重试物理删除，失败保留错误供排障。
 */
@Injectable()
export class AttachmentCleanupService {
  private readonly logger = new Logger(AttachmentCleanupService.name);
  private lastRunAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  /** 由 AttachmentScheduler 调用；这里不依赖 @nestjs/schedule，保持纯 Service 可单测。 */
  async tick(): Promise<void> {
    if (this.config.get<string>('ATTACHMENT_ENABLED') !== 'true') return;
    const intervalMs = this.cleanupIntervalSeconds() * 1000;
    if (Date.now() - this.lastRunAt < intervalMs) return;
    this.lastRunAt = Date.now();
    await this.cleanupOnce();
  }

  async cleanupOnce(): Promise<void> {
    const now = new Date();
    await this.expirePending(now);
    await this.purgeDeleted(now);
  }

  private async expirePending(now: Date): Promise<void> {
    const expired = await this.prisma.transactionAttachment.findMany({
      where: {
        status: 'PENDING',
        uploadExpiresAt: { lte: now },
        deletedAt: null,
      },
      select: { id: true, objectKey: true },
      take: BATCH_SIZE,
    });
    for (const attachment of expired) {
      await this.prisma.transactionAttachment.updateMany({
        where: { id: attachment.id, status: 'PENDING' },
        data: { status: 'DELETED', deletedAt: now },
      });
      await this.safeDeleteObject(attachment.id, attachment.objectKey);
    }
  }

  private async purgeDeleted(now: Date): Promise<void> {
    const deleted = await this.prisma.transactionAttachment.findMany({
      where: {
        status: 'DELETED',
        purgedAt: null,
        deletedAt: { not: null, lte: now },
      },
      select: { id: true, objectKey: true },
      take: BATCH_SIZE,
    });
    for (const attachment of deleted) {
      await this.safeDeleteObject(attachment.id, attachment.objectKey);
    }
  }

  private async safeDeleteObject(attachmentId: string, objectKey: string): Promise<void> {
    try {
      await this.storage.deleteObject(objectKey);
      await this.prisma.transactionAttachment.update({
        where: { id: attachmentId },
        data: { purgedAt: new Date(), lastPurgeError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '对象删除失败';
      this.logger.warn(`附件对象清理失败 ${attachmentId}: ${message}`);
      await this.prisma.transactionAttachment.update({
        where: { id: attachmentId },
        data: {
          purgeAttempts: { increment: 1 },
          lastPurgeError: message.slice(0, 500),
        },
      });
    }
  }

  private cleanupIntervalSeconds(): number {
    const raw = this.config.get<string | number>('ATTACHMENT_CLEANUP_INTERVAL_SECONDS');
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) && value > 0
      ? value
      : ATTACHMENT_CLEANUP_INTERVAL_SECONDS;
  }
}
