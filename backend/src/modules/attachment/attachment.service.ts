import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_TRANSACTION,
  ATTACHMENT_READ_TTL_SECONDS,
  ATTACHMENT_UPLOAD_TTL_SECONDS,
  ATTACHMENT_USER_QUOTA_BYTES,
  detectImageMimeType,
  extensionForMimeType,
} from './attachment.constants';
import type {
  AttachmentAccessUrlResult,
  AttachmentSummary,
  AttachmentUploadSessionResult,
  CompletedAttachmentResult,
  CreateAttachmentUploadInput,
} from './attachment.types';
import { OBJECT_STORAGE, type ObjectStoragePort } from './object-storage/object-storage.port';

const attachmentSelect = {
  id: true,
  ledgerId: true,
  transactionId: true,
  uploadedById: true,
  clientRequestId: true,
  objectKey: true,
  originalName: true,
  declaredMimeType: true,
  declaredSizeBytes: true,
  mimeType: true,
  sizeBytes: true,
  checksumSha256: true,
  status: true,
  uploadExpiresAt: true,
  uploadedAt: true,
  deletedAt: true,
  createdAt: true,
} as const;

type AttachmentRecord = Prisma.TransactionAttachmentGetPayload<{
  select: typeof attachmentSelect;
}>;

@Injectable()
export class AttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async createUploadSession(
    userId: string,
    ledgerId: string,
    transactionId: string,
    input: CreateAttachmentUploadInput,
  ): Promise<AttachmentUploadSessionResult> {
    this.ensureEnabled();
    await this.requireMember(userId, ledgerId, ['OWNER', 'EDITOR']);
    this.validateCreateInput(input);

    const existing = await this.prisma.transactionAttachment.findUnique({
      where: {
        transactionId_clientRequestId: {
          transactionId,
          clientRequestId: input.clientRequestId,
        },
      },
      select: attachmentSelect,
    });
    if (existing) {
      if (existing.ledgerId !== ledgerId || existing.uploadedById !== userId) {
        throw this.notFoundException();
      }
      return this.sessionForExisting(existing);
    }

    const quotaUsed = await this.getUserQuotaUsed(userId);
    if (quotaUsed + input.sizeBytes > this.userQuotaBytes()) {
      throw new ConflictException({ code: 40942, message: '附件存储配额不足', data: null });
    }

    const attachmentId = randomUUID();
    const mimeType = input.mimeType;
    const objectKey = `ledgers/${ledgerId}/attachments/${attachmentId}.${extensionForMimeType(mimeType)}`;

    // 先在事务外签名，避免对象存储抖动时长时间持有账单行锁。
    // 数量/配额竞争仍由下面的事务内行锁和计数兜底。
    const upload = await this.storage.createUploadUrl(
      objectKey,
      mimeType,
      this.uploadTtlSeconds(),
    );

    try {
      await this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM "transaction"
          WHERE id = ${transactionId} AND ledger_id = ${ledgerId} AND deleted_at IS NULL
          FOR UPDATE
        `);
        if (locked.length === 0) throw this.notFoundException();

        const activeCount = await transaction.transactionAttachment.count({
          where: { transactionId, status: { in: ['PENDING', 'ATTACHED'] } },
        });
        if (activeCount >= this.maxPerTransaction()) {
          throw new ConflictException({ code: 40941, message: '单笔账单附件数量已达上限', data: null });
        }

        await transaction.transactionAttachment.create({
          data: {
            id: attachmentId,
            ledgerId,
            transactionId,
            uploadedById: userId,
            clientRequestId: input.clientRequestId,
            objectKey,
            originalName: this.normalizeFileName(input.fileName),
            declaredMimeType: mimeType,
            declaredSizeBytes: input.sizeBytes,
            status: 'PENDING',
            uploadExpiresAt: upload.expiresAt,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const concurrent = await this.prisma.transactionAttachment.findUnique({
          where: {
            transactionId_clientRequestId: {
              transactionId,
              clientRequestId: input.clientRequestId,
            },
          },
          select: attachmentSelect,
        });
        if (concurrent && concurrent.ledgerId === ledgerId && concurrent.uploadedById === userId) {
          return this.sessionForExisting(concurrent);
        }
      }
      throw error;
    }

    return {
      attachmentId,
      status: 'PENDING',
      uploadMethod: 'PUT',
      uploadUrl: upload.url,
      requiredHeaders: upload.headers,
      expiresAt: upload.expiresAt,
    };
  }

  async complete(
    userId: string,
    ledgerId: string,
    attachmentId: string,
  ): Promise<CompletedAttachmentResult> {
    this.ensureEnabled();
    await this.requireMember(userId, ledgerId, ['OWNER', 'EDITOR']);
    const attachment = await this.findOwnedAttachment(userId, ledgerId, attachmentId);

    if (attachment.status === 'ATTACHED') {
      return this.completedResult(attachment);
    }
    if (attachment.status !== 'PENDING') throw this.stateConflictException(attachment.status);
    if (!attachment.uploadExpiresAt || attachment.uploadExpiresAt <= new Date()) {
      throw this.stateConflictException('EXPIRED');
    }

    let head;
    try {
      head = await this.storage.headObject(attachment.objectKey);
    } catch (error) {
      if (this.isStorageNotFound(error)) {
        await this.recordUploadError(attachment.id, '上传对象不存在');
        throw this.badRequestException('上传对象不存在或尚未完成上传');
      }
      throw this.storageUnavailableException();
    }

    if (head.contentLength <= 0 || head.contentLength > this.maxBytes()) {
      await this.recordUploadError(attachment.id, '对象大小不合法');
      throw this.badRequestException('图片大小不符合限制');
    }

    let prefix: Buffer;
    try {
      prefix = await this.storage.readPrefix(attachment.objectKey, 12);
    } catch {
      throw this.storageUnavailableException();
    }
    const mimeType = detectImageMimeType(prefix);
    if (!mimeType) {
      await this.recordUploadError(attachment.id, '对象内容不是支持的图片类型');
      throw new UnsupportedMediaTypeException({
        code: 41501,
        message: '仅支持 JPEG、PNG 或 WebP 图片',
        data: null,
      });
    }

    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.transactionAttachment.updateMany({
        where: {
          id: attachment.id,
          status: 'PENDING',
          uploadExpiresAt: { gt: now },
        },
        data: {
          status: 'ATTACHED',
          mimeType,
          sizeBytes: head.contentLength,
          uploadedAt: now,
          lastUploadError: null,
        },
      });
      if (updated.count !== 1) throw this.stateConflictException('ATTACHED');
      await transaction.transactionAuditLog.create({
        data: {
          ledgerId,
          transactionId: attachment.transactionId,
          operatorId: userId,
          action: 'ATTACHMENT_ADD',
          afterData: {
            attachmentId: attachment.id,
            mimeType,
            sizeBytes: head.contentLength,
          },
        },
      });
    });

    const completed = await this.findOwnedAttachment(userId, ledgerId, attachment.id);
    // 条件更新已成功；部分测试/事务回读可能仍返回旧快照，补上本次已写入的真实值。
    return this.completedResult({
      ...completed,
      status: 'ATTACHED',
      mimeType,
      sizeBytes: head.contentLength,
      uploadedAt: now,
    });
  }

  async getAccessUrl(
    userId: string,
    ledgerId: string,
    attachmentId: string,
  ): Promise<AttachmentAccessUrlResult> {
    this.ensureEnabled();
    await this.requireMember(userId, ledgerId);
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: { id: attachmentId, ledgerId, status: 'ATTACHED', deletedAt: null },
      select: {
        id: true,
        objectKey: true,
        transaction: {
          select: {
            deletedAt: true,
            account: { select: { visibility: true, ownerId: true } },
          },
        },
      },
    });
    if (!attachment || attachment.transaction.deletedAt) throw this.notFoundException();
    if (
      attachment.transaction.account?.visibility === 'PRIVATE' &&
      attachment.transaction.account.ownerId !== userId
    ) {
      throw this.notFoundException();
    }

    const expiresIn = this.readTtlSeconds();
    return {
      attachmentId: attachment.id,
      accessUrl: await this.storage.createDownloadUrl(attachment.objectKey, expiresIn),
      accessUrlExpiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async remove(
    userId: string,
    ledgerId: string,
    transactionId: string,
    attachmentId: string,
  ): Promise<null> {
    this.ensureEnabled();
    await this.requireMember(userId, ledgerId, ['OWNER', 'EDITOR']);
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: { id: attachmentId, ledgerId, transactionId },
      select: { ...attachmentSelect, transaction: { select: { deletedAt: true } } },
    });
    if (!attachment || attachment.transaction.deletedAt) throw this.notFoundException();
    if (attachment.status === 'DELETED') return null;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.transactionAttachment.update({
        where: { id: attachment.id },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
      await transaction.transactionAuditLog.create({
        data: {
          ledgerId,
          transactionId,
          operatorId: userId,
          action: 'ATTACHMENT_REMOVE',
          beforeData: { attachmentId: attachment.id, mimeType: attachment.mimeType },
        },
      });
    });
    return null;
  }

  private async findOwnedAttachment(
    userId: string,
    ledgerId: string,
    attachmentId: string,
  ): Promise<AttachmentRecord> {
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: {
        id: attachmentId,
        ledgerId,
        uploadedById: userId,
        transaction: { deletedAt: null },
      },
      select: attachmentSelect,
    });
    if (!attachment) throw this.notFoundException();
    return attachment;
  }

  private async sessionForExisting(
    attachment: AttachmentRecord,
  ): Promise<AttachmentUploadSessionResult> {
    if (attachment.status === 'ATTACHED') {
      return {
        attachmentId: attachment.id,
        status: 'ATTACHED',
        uploadMethod: 'PUT',
        uploadUrl: '',
        requiredHeaders: {},
        expiresAt: new Date(),
      };
    }
    if (attachment.status !== 'PENDING') throw this.stateConflictException(attachment.status);
    if (!attachment.uploadExpiresAt || attachment.uploadExpiresAt <= new Date()) {
      await this.prisma.transactionAttachment.update({
        where: { id: attachment.id },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
      throw this.stateConflictException('EXPIRED');
    }

    const mimeType = attachment.declaredMimeType ?? 'image/jpeg';
    const upload = await this.storage.createUploadUrl(
      attachment.objectKey,
      mimeType,
      this.uploadTtlSeconds(),
    );
    await this.prisma.transactionAttachment.update({
      where: { id: attachment.id },
      data: { uploadExpiresAt: upload.expiresAt },
    });
    return {
      attachmentId: attachment.id,
      status: 'PENDING',
      uploadMethod: 'PUT',
      uploadUrl: upload.url,
      requiredHeaders: upload.headers,
      expiresAt: upload.expiresAt,
    };
  }

  private async completedResult(attachment: AttachmentRecord): Promise<CompletedAttachmentResult> {
    // complete 已通过条件更新保证状态；这里仍校验，防止误把 PENDING 当可读。
    if (attachment.status !== 'ATTACHED') throw this.stateConflictException(attachment.status);
    const expiresIn = this.readTtlSeconds();
    const [accessUrl, attachmentCount] = await Promise.all([
      this.storage.createDownloadUrl(attachment.objectKey, expiresIn),
      this.prisma.transactionAttachment.count({
        where: {
          transactionId: attachment.transactionId,
          status: 'ATTACHED',
          deletedAt: null,
        },
      }),
    ]);
    return {
      ...this.toSummary(attachment),
      attachmentCount,
      accessUrl,
      accessUrlExpiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  private toSummary(attachment: AttachmentRecord): AttachmentSummary {
    return {
      id: attachment.id,
      status: attachment.status,
      transactionId: attachment.transactionId,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      originalName: attachment.originalName,
      createdAt: attachment.createdAt,
    };
  }

  private async requireMember(
    userId: string,
    ledgerId: string,
    roles?: Array<'OWNER' | 'EDITOR' | 'VIEWER'>,
  ): Promise<void> {
    const member = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    if (roles && !roles.includes(member.role)) {
      throw new ForbiddenException({ code: 40341, message: '当前成员不能管理附件', data: null });
    }
  }

  private async getUserQuotaUsed(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COALESCE(SUM(COALESCE(size_bytes, declared_size_bytes, 0)), 0)::bigint AS total
      FROM "transaction_attachment"
      WHERE uploaded_by_id = ${userId} AND status IN ('PENDING', 'ATTACHED')
    `);
    return Number(rows[0]?.total ?? 0);
  }

  private async recordUploadError(attachmentId: string, message: string): Promise<void> {
    await this.prisma.transactionAttachment.update({
      where: { id: attachmentId },
      data: { lastUploadError: message.slice(0, 500) },
    });
  }

  private validateCreateInput(input: CreateAttachmentUploadInput): void {
    if (input.sizeBytes <= 0 || input.sizeBytes > this.maxBytes()) {
      throw this.badRequestException('图片大小不符合限制');
    }
    if (!input.fileName.trim()) throw this.badRequestException('图片文件名不能为空');
  }

  private normalizeFileName(fileName: string): string {
    return fileName.replace(/[\\/]/g, '_').trim().slice(0, 255);
  }

  private ensureEnabled(): void {
    const enabled = this.config.get<string>('ATTACHMENT_ENABLED') ?? 'false';
    if (enabled !== 'true') {
      throw this.storageUnavailableException();
    }
  }

  private maxBytes(): number {
    return this.getPositiveInt('ATTACHMENT_MAX_BYTES', ATTACHMENT_MAX_BYTES);
  }

  private maxPerTransaction(): number {
    return this.getPositiveInt('ATTACHMENT_MAX_PER_TRANSACTION', ATTACHMENT_MAX_PER_TRANSACTION);
  }

  private userQuotaBytes(): number {
    return this.getPositiveInt('ATTACHMENT_USER_QUOTA_BYTES', ATTACHMENT_USER_QUOTA_BYTES);
  }

  private uploadTtlSeconds(): number {
    return this.getPositiveInt('OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS', ATTACHMENT_UPLOAD_TTL_SECONDS);
  }

  private readTtlSeconds(): number {
    return this.getPositiveInt('OBJECT_STORAGE_READ_URL_TTL_SECONDS', ATTACHMENT_READ_TTL_SECONDS);
  }

  private getPositiveInt(key: string, fallback: number): number {
    const raw = this.config.get<string | number>(key);
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private isStorageNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { name?: string; code?: string; status?: number; $metadata?: { httpStatusCode?: number } };
    return (
      candidate.name === 'NoSuchKey' ||
      candidate.name === 'NotFound' ||
      candidate.code === 'NoSuchKey' ||
      candidate.status === 404 ||
      candidate.$metadata?.httpStatusCode === 404
    );
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({ code: 40441, message: '附件或账单不可见', data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({ code: 40341, message: '当前成员不能管理附件', data: null });
  }

  private badRequestException(message: string): BadRequestException {
    return new BadRequestException({ code: 40041, message, data: null });
  }

  private stateConflictException(status: string): ConflictException {
    return new ConflictException({ code: 40941, message: '附件状态已变化', data: { status } });
  }

  private storageUnavailableException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 50341,
      message: '对象存储不可用或附件功能关闭',
      data: null,
    });
  }
}
