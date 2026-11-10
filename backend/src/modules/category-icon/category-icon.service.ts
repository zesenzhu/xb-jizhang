import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { detectImageMimeType } from '../attachment/attachment.constants';
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from '../attachment/object-storage/object-storage.port';
import {
  CATEGORY_ICON_ALLOWED_MIME_TYPES,
  CATEGORY_ICON_FILE_HEADER_BYTES,
  CATEGORY_ICON_LIBRARY,
  DEFAULT_CATEGORY_ICON_LEDGER_QUOTA_BYTES,
  DEFAULT_CATEGORY_ICON_MAX_BYTES,
  DEFAULT_CATEGORY_ICON_ORPHAN_TTL_SECONDS,
  DEFAULT_CATEGORY_ICON_READ_URL_TTL_SECONDS,
  DEFAULT_CATEGORY_ICON_UPLOAD_URL_TTL_SECONDS,
  getExtensionForCategoryIcon,
} from './category-icon.constants';
import type {
  CategoryIconLibraryQuery,
  CategoryIconSummary,
  CategoryIconUploadSession,
  CreateCategoryIconUploadInput,
} from './category-icon.types';

const assetSelect = {
  id: true,
  ledgerId: true,
  uploadedById: true,
  clientRequestId: true,
  objectKey: true,
  originalName: true,
  declaredMimeType: true,
  declaredSizeBytes: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  uploadExpiresAt: true,
  orphanExpiresAt: true,
  uploadedAt: true,
  deletedAt: true,
  purgedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true } },
} as const;

type CategoryIconAssetRecord = Prisma.CategoryIconAssetGetPayload<{
  select: typeof assetSelect;
}>;

@Injectable()
export class CategoryIconService {
  private readonly enabled: boolean;
  private readonly maxBytes: number;
  private readonly ledgerQuotaBytes: number;
  private readonly uploadUrlTtlSeconds: number;
  private readonly readUrlTtlSeconds: number;
  private readonly orphanTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStoragePort,
  ) {
    this.enabled =
      configService.get<string>('CATEGORY_ICON_ENABLED') === 'true';
    this.maxBytes = readPositiveNumber(
      configService,
      'CATEGORY_ICON_MAX_BYTES',
      DEFAULT_CATEGORY_ICON_MAX_BYTES,
    );
    this.ledgerQuotaBytes = readPositiveNumber(
      configService,
      'CATEGORY_ICON_LEDGER_QUOTA_BYTES',
      DEFAULT_CATEGORY_ICON_LEDGER_QUOTA_BYTES,
    );
    this.uploadUrlTtlSeconds = readPositiveNumber(
      configService,
      'CATEGORY_ICON_UPLOAD_URL_TTL_SECONDS',
      DEFAULT_CATEGORY_ICON_UPLOAD_URL_TTL_SECONDS,
    );
    this.readUrlTtlSeconds = readPositiveNumber(
      configService,
      'CATEGORY_ICON_READ_URL_TTL_SECONDS',
      DEFAULT_CATEGORY_ICON_READ_URL_TTL_SECONDS,
    );
    this.orphanTtlSeconds = readPositiveNumber(
      configService,
      'CATEGORY_ICON_ORPHAN_TTL_SECONDS',
      DEFAULT_CATEGORY_ICON_ORPHAN_TTL_SECONDS,
    );
  }

  async listLibrary(
    userId: string,
    ledgerId: string,
    query: CategoryIconLibraryQuery,
  ) {
    await this.requireActiveMember(userId, ledgerId);
    const search = query.q?.trim().toLocaleLowerCase();
    const items = CATEGORY_ICON_LIBRARY.filter((icon) => {
      if (query.type && !icon.defaultTypes.includes(query.type)) return false;
      if (!search) return true;
      return [icon.key, icon.label, icon.group, ...icon.aliases]
        .join(' ')
        .toLocaleLowerCase()
        .includes(search);
    });
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
    return {
      items: pageItems,
      total: items.length,
      page,
      pageSize,
      hasNextPage: page * pageSize < items.length,
    };
  }

  async createUploadSession(
    userId: string,
    ledgerId: string,
    input: CreateCategoryIconUploadInput,
  ): Promise<{ asset: CategoryIconUploadSession; reused: boolean }> {
    this.ensureEnabled();
    await this.requireOwner(userId, ledgerId);
    this.validateDeclaredFile(input);

    const result = await this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      const lockedLedgers = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "ledger" WHERE id = ${ledgerId} FOR UPDATE`,
      );
      if (lockedLedgers.length === 0) throw this.notFoundException();

      const existing = await transaction.categoryIconAsset.findUnique({
        where: {
          ledgerId_clientRequestId: {
            ledgerId,
            clientRequestId: input.clientRequestId,
          },
        },
        select: assetSelect,
      });
      if (existing?.status === 'ATTACHED')
        return { record: existing, created: false, needsUpload: false };
      if (
        existing?.status === 'PENDING' &&
        existing.uploadExpiresAt &&
        existing.uploadExpiresAt > now
      ) {
        return { record: existing, created: false, needsUpload: true };
      }
      if (existing) throw this.conflictException();

      const [pendingBytes, attachedBytes] = await Promise.all([
        transaction.categoryIconAsset.aggregate({
          where: { ledgerId, status: 'PENDING', uploadExpiresAt: { gt: now } },
          _sum: { declaredSizeBytes: true },
        }),
        transaction.categoryIconAsset.aggregate({
          where: { ledgerId, status: 'ATTACHED' },
          _sum: { sizeBytes: true },
        }),
      ]);
      const usedBytes =
        (pendingBytes._sum.declaredSizeBytes ?? 0) +
        (attachedBytes._sum.sizeBytes ?? 0);
      if (usedBytes + input.sizeBytes > this.ledgerQuotaBytes)
        throw this.quotaException();

      const id = randomUUID();
      const record = await transaction.categoryIconAsset.create({
        data: {
          id,
          ledgerId,
          uploadedById: userId,
          clientRequestId: input.clientRequestId,
          objectKey: `ledgers/${ledgerId}/category-icons/${id}.${getExtensionForCategoryIcon(input.mimeType)}`,
          originalName: sanitizeFileName(input.fileName),
          declaredMimeType: input.mimeType,
          declaredSizeBytes: input.sizeBytes,
          uploadExpiresAt: new Date(
            now.getTime() + this.uploadUrlTtlSeconds * 1000,
          ),
          orphanExpiresAt: new Date(
            now.getTime() + this.orphanTtlSeconds * 1000,
          ),
        },
        select: assetSelect,
      });
      return { record, created: true, needsUpload: true };
    });

    if (!result.needsUpload)
      return { asset: await this.withAccessUrl(result.record), reused: true };
    try {
      const signed = await this.objectStorage.createUploadUrl(
        result.record.objectKey,
        result.record.declaredMimeType,
        this.uploadUrlTtlSeconds,
      );
      return {
        asset: {
          ...this.toSummary(result.record),
          uploadMethod: 'PUT',
          uploadUrl: signed.url,
          requiredHeaders: signed.headers,
          expiresAt: signed.expiresAt,
        },
        reused: !result.created,
      };
    } catch (error) {
      if (result.created) {
        await this.prisma.categoryIconAsset.updateMany({
          where: { id: result.record.id, status: 'PENDING' },
          data: {
            status: 'DELETED',
            deletedAt: new Date(),
            lastUploadError: this.errorMessage(error),
          },
        });
      }
      throw this.storageUnavailableException();
    }
  }

  async complete(
    userId: string,
    ledgerId: string,
    assetId: string,
  ): Promise<CategoryIconSummary> {
    this.ensureEnabled();
    await this.requireOwner(userId, ledgerId);
    const record = await this.prisma.categoryIconAsset.findFirst({
      where: { id: assetId, ledgerId },
      select: assetSelect,
    });
    if (!record || record.status === 'DELETED') throw this.notFoundException();
    if (record.status === 'ATTACHED') return this.withAccessUrl(record);
    if (record.uploadExpiresAt && record.uploadExpiresAt <= new Date())
      throw this.conflictException();

    let head: {
      contentLength: number;
      contentType: string | null;
      etag: string | null;
    };
    let prefix: Buffer;
    try {
      head = await this.objectStorage.headObject(record.objectKey);
      prefix = await this.objectStorage.readPrefix(
        record.objectKey,
        CATEGORY_ICON_FILE_HEADER_BYTES,
      );
    } catch (error) {
      if (isObjectNotFound(error)) {
        await this.saveUploadError(record.id, '对象尚未上传完成');
        throw this.invalidInputException('对象尚未上传完成');
      }
      throw this.storageUnavailableException();
    }

    if (head.contentLength > this.maxBytes || head.contentLength <= 0) {
      await this.saveUploadError(
        record.id,
        `文件大小 ${head.contentLength} 超出限制`,
      );
      throw this.tooLargeException();
    }
    const actualMimeType = detectImageMimeType(prefix);
    if (
      !actualMimeType ||
      actualMimeType !== record.declaredMimeType ||
      !CATEGORY_ICON_ALLOWED_MIME_TYPES.includes(actualMimeType)
    ) {
      await this.saveUploadError(
        record.id,
        `文件类型 ${actualMimeType ?? 'unknown'} 与声明不一致`,
      );
      throw this.unsupportedMediaTypeException();
    }

    const attached = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.categoryIconAsset.updateMany({
        where: { id: record.id, ledgerId, status: 'PENDING' },
        data: {
          status: 'ATTACHED',
          mimeType: actualMimeType,
          sizeBytes: head.contentLength,
          uploadedAt: new Date(),
          orphanExpiresAt: new Date(Date.now() + this.orphanTtlSeconds * 1000),
          lastUploadError: null,
        },
      });
      if (updated.count === 0) {
        const latest = await transaction.categoryIconAsset.findUnique({
          where: { id: record.id },
          select: assetSelect,
        });
        if (latest?.status === 'ATTACHED') return latest;
        throw this.conflictException();
      }
      return transaction.categoryIconAsset.findUnique({
        where: { id: record.id },
        select: assetSelect,
      });
    });
    if (!attached) throw this.notFoundException();
    return this.withAccessUrl(attached);
  }

  async getAccessUrl(
    userId: string,
    ledgerId: string,
    assetId: string,
  ): Promise<CategoryIconSummary> {
    this.ensureEnabled();
    const member = await this.requireActiveMember(userId, ledgerId);
    const record = await this.prisma.categoryIconAsset.findFirst({
      where: { id: assetId, ledgerId, status: 'ATTACHED' },
      select: assetSelect,
    });
    if (!record) throw this.notFoundException();
    if (
      !record.category &&
      (record.uploadedById !== userId ||
        !record.orphanExpiresAt ||
        record.orphanExpiresAt <= new Date())
    ) {
      throw this.notFoundException();
    }
    void member;
    return this.withAccessUrl(record);
  }

  async getBoundIconUrl(
    userId: string,
    ledgerId: string,
    assetId: string,
  ): Promise<{ url: string; expiresAt: Date } | null> {
    if (!this.enabled) return null;
    try {
      const summary = await this.getAccessUrl(userId, ledgerId, assetId);
      if (!summary.accessUrl || !summary.accessUrlExpiresAt) return null;
      return { url: summary.accessUrl, expiresAt: summary.accessUrlExpiresAt };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      )
        return null;
      throw error;
    }
  }

  async validateBindableAsset(
    client: PrismaService | Prisma.TransactionClient,
    ledgerId: string,
    assetId: string,
    categoryId: string | null,
  ): Promise<void> {
    this.ensureEnabled();
    const asset = await client.categoryIconAsset.findFirst({
      where: { id: assetId, ledgerId, status: 'ATTACHED' },
      select: { id: true, category: { select: { id: true } } },
    });
    if (!asset) throw this.notFoundException();
    if (asset.category && asset.category.id !== categoryId)
      throw this.conflictException();
  }

  async cleanupExpiredAndDeleted(): Promise<{
    cleaned: number;
    failed: number;
  }> {
    if (!this.enabled) return { cleaned: 0, failed: 0 };
    const now = new Date();
    const candidates = await this.prisma.categoryIconAsset.findMany({
      where: {
        OR: [
          { status: 'PENDING', uploadExpiresAt: { lt: now } },
          {
            status: 'ATTACHED',
            orphanExpiresAt: { lt: now },
            category: { is: null },
          },
          { status: 'DELETED', purgedAt: null },
        ],
      },
      select: { id: true, objectKey: true, status: true },
      take: 100,
    });
    let cleaned = 0;
    let failed = 0;
    for (const candidate of candidates) {
      if (candidate.status !== 'DELETED') {
        const marked = await this.prisma.categoryIconAsset.updateMany({
          where:
            candidate.status === 'PENDING'
              ? {
                  id: candidate.id,
                  status: 'PENDING',
                  uploadExpiresAt: { lt: now },
                }
              : {
                  id: candidate.id,
                  status: 'ATTACHED',
                  orphanExpiresAt: { lt: now },
                  category: { is: null },
                },
          data: { status: 'DELETED', deletedAt: now },
        });
        if (marked.count === 0) continue;
      }
      try {
        await this.objectStorage.deleteObject(candidate.objectKey);
        await this.prisma.categoryIconAsset.updateMany({
          where: { id: candidate.id, status: 'DELETED', purgedAt: null },
          data: {
            purgedAt: new Date(),
            purgeAttempts: { increment: 1 },
            lastPurgeError: null,
          },
        });
        cleaned += 1;
      } catch (error) {
        failed += 1;
        await this.prisma.categoryIconAsset.updateMany({
          where: { id: candidate.id, status: 'DELETED', purgedAt: null },
          data: {
            purgeAttempts: { increment: 1 },
            lastPurgeError: this.errorMessage(error),
          },
        });
      }
    }
    return { cleaned, failed };
  }

  private async withAccessUrl(
    record: CategoryIconAssetRecord,
  ): Promise<CategoryIconSummary> {
    try {
      const signed = await this.objectStorage.createDownloadUrl(
        record.objectKey,
        this.readUrlTtlSeconds,
      );
      return {
        ...this.toSummary(record),
        accessUrl: signed,
        accessUrlExpiresAt: new Date(
          Date.now() + this.readUrlTtlSeconds * 1000,
        ),
      };
    } catch {
      throw this.storageUnavailableException();
    }
  }

  private async requireOwner(userId: string, ledgerId: string): Promise<void> {
    const member = await this.requireActiveMember(userId, ledgerId);
    if (member.role !== 'OWNER') throw this.forbiddenException();
  }

  private async requireActiveMember(userId: string, ledgerId: string) {
    const member = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { role: true, status: true },
    });
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    return member;
  }

  private validateDeclaredFile(input: CreateCategoryIconUploadInput): void {
    if (
      !Number.isInteger(input.sizeBytes) ||
      input.sizeBytes <= 0 ||
      input.sizeBytes > this.maxBytes ||
      !CATEGORY_ICON_ALLOWED_MIME_TYPES.includes(input.mimeType)
    ) {
      if (input.sizeBytes > this.maxBytes) throw this.tooLargeException();
      throw this.invalidInputException();
    }
    if (!sanitizeFileName(input.fileName)) throw this.invalidInputException();
  }

  private async saveUploadError(id: string, message: string): Promise<void> {
    await this.prisma.categoryIconAsset.updateMany({
      where: { id, status: 'PENDING' },
      data: { lastUploadError: message },
    });
  }

  private toSummary(record: CategoryIconAssetRecord): CategoryIconSummary {
    return {
      assetId: record.id,
      status: record.status,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      createdAt: record.createdAt,
      uploadedAt: record.uploadedAt,
    };
  }

  private ensureEnabled(): void {
    if (!this.enabled) throw this.storageUnavailableException();
  }

  private invalidInputException(
    message = '分类图标参数不合法',
  ): BadRequestException {
    return new BadRequestException({ code: 40021, message, data: null });
  }

  private forbiddenException(): ForbiddenException {
    return new ForbiddenException({
      code: 40321,
      message: '当前成员不能管理分类图标',
      data: null,
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({
      code: 40421,
      message: '分类图标资源不存在',
      data: null,
    });
  }

  private conflictException(): ConflictException {
    return new ConflictException({
      code: 40921,
      message: '分类图标资源状态已变化，请重试',
      data: null,
    });
  }

  private quotaException(): ConflictException {
    return new ConflictException({
      code: 40942,
      message: '账本分类图标配额不足',
      data: null,
    });
  }

  private tooLargeException(): PayloadTooLargeException {
    return new PayloadTooLargeException({
      code: 41301,
      message: '分类图标超过大小限制',
      data: null,
    });
  }

  private unsupportedMediaTypeException(): UnsupportedMediaTypeException {
    return new UnsupportedMediaTypeException({
      code: 41501,
      message: '不支持的图片类型',
      data: null,
    });
  }

  private storageUnavailableException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 50341,
      message: '对象存储暂不可用或分类图标功能已关闭',
      data: null,
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message.slice(0, 500)
      : '对象存储清理失败';
  }
}

function readPositiveNumber(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const value = Number(config.get<string>(key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return character === '\\' ||
        character === '/' ||
        code <= 0x1f ||
        code === 0x7f
        ? '_'
        : character;
    })
    .join('')
    .trim()
    .slice(0, 128);
}

function isObjectNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    value.name === 'NotFound' ||
    value.name === 'NoSuchKey' ||
    value.$metadata?.httpStatusCode === 404
  );
}
