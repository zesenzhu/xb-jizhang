import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ObjectStoragePort } from './object-storage/object-storage.port';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentService } from './attachment.service';

describe('AttachmentService', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';
  const transactionId = 'transaction-1';
  const attachmentId = 'attachment-1';
  const now = new Date('2026-11-10T09:00:00.000Z');
  const baseAttachment = {
    id: attachmentId,
    ledgerId,
    transactionId,
    uploadedById: userId,
    clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
    objectKey: `ledgers/${ledgerId}/attachments/${attachmentId}.jpg`,
    originalName: 'receipt.jpg',
    declaredMimeType: 'image/jpeg',
    declaredSizeBytes: 100,
    mimeType: null,
    sizeBytes: null,
    checksumSha256: null,
    status: 'PENDING' as const,
    uploadExpiresAt: new Date(Date.now() + 60_000),
    uploadedAt: null,
    deletedAt: null,
    createdAt: now,
  };
  const storage: ObjectStoragePort = {
    createUploadUrl: jest.fn().mockResolvedValue({
      url: 'https://storage.example/upload',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: new Date(now.getTime() + 600_000),
    }),
    createDownloadUrl: jest.fn().mockResolvedValue('https://storage.example/read'),
    headObject: jest.fn().mockResolvedValue({ contentLength: 100, contentType: 'image/jpeg', etag: 'etag' }),
    readPrefix: jest.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff])),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    ensureCors: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        ATTACHMENT_ENABLED: 'true',
        ATTACHMENT_MAX_BYTES: '10485760',
        ATTACHMENT_MAX_PER_TRANSACTION: '5',
        ATTACHMENT_USER_QUOTA_BYTES: '2147483648',
        OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS: '600',
        OBJECT_STORAGE_READ_URL_TTL_SECONDS: '300',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  const createService = () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: transactionId }]),
      transactionAttachment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }) => ({ ...baseAttachment, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      transactionAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      ledgerMember: { findUnique: jest.fn().mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' }) },
      transactionAttachment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ total: BigInt(0) }]),
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    return {
      prisma,
      tx,
      service: new AttachmentService(
        prisma as unknown as PrismaService,
        config,
        storage,
      ),
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('给定 Owner/Editor 创建上传会话，当数量与配额合法，则写入 PENDING 并返回预签名地址', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findUnique.mockResolvedValue(null);

    const result = await d.service.createUploadSession(userId, ledgerId, transactionId, {
      clientRequestId: baseAttachment.clientRequestId,
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    });

    expect(result.status).toBe('PENDING');
    expect(result.uploadMethod).toBe('PUT');
    expect(result.uploadUrl).toContain('upload');
    expect(d.tx.transactionAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ledgerId,
          transactionId,
          uploadedById: userId,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('给定单笔已有 5 张，当创建会话，则返回 40941 且不创建记录', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findUnique.mockResolvedValue(null);
    d.tx.transactionAttachment.count.mockResolvedValue(5);

    await expect(
      d.service.createUploadSession(userId, ledgerId, transactionId, {
        clientRequestId: baseAttachment.clientRequestId,
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ response: { code: 40941 } });
    expect(d.tx.transactionAttachment.create).not.toHaveBeenCalled();
  });

  it('给定附件已完成，当重复创建相同 clientRequestId，则返回 ATTACHED 且不重签上传地址', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findUnique.mockResolvedValue({
      ...baseAttachment,
      status: 'ATTACHED',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    });

    const result = await d.service.createUploadSession(userId, ledgerId, transactionId, {
      clientRequestId: baseAttachment.clientRequestId,
      fileName: 'receipt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    });

    expect(result).toEqual(expect.objectContaining({ status: 'ATTACHED', uploadUrl: '' }));
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('给定对象大小与魔数合法，当完成上传，则更新 ATTACHED 并写审计', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findFirst.mockResolvedValue(baseAttachment);
    d.prisma.transactionAttachment.findUnique.mockResolvedValue({
      ...baseAttachment,
      status: 'ATTACHED',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      uploadedAt: now,
    });

    const result = await d.service.complete(userId, ledgerId, attachmentId);

    expect(result.status).toBe('ATTACHED');
    expect(result.accessUrl).toContain('read');
    expect(d.tx.transactionAttachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ATTACHED', mimeType: 'image/jpeg' }) }),
    );
    expect(d.tx.transactionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ATTACHMENT_ADD' }) }),
    );
  });

  it('给定对象魔数不是图片，当完成上传，则返回 41501 且不改为可读', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findFirst.mockResolvedValue(baseAttachment);
    (storage.readPrefix as jest.Mock).mockResolvedValue(Buffer.from('<html>'));

    await expect(d.service.complete(userId, ledgerId, attachmentId)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(d.tx.transactionAttachment.updateMany).not.toHaveBeenCalled();
  });

  it('给定对象超限，当完成上传，则返回 40041', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findFirst.mockResolvedValue(baseAttachment);
    (storage.headObject as jest.Mock).mockResolvedValue({ contentLength: 20 * 1024 * 1024, contentType: 'image/jpeg', etag: null });

    await expect(d.service.complete(userId, ledgerId, attachmentId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('给定 VIEWER，当创建会话，则返回 40341', async () => {
    const d = createService();
    d.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      d.service.createUploadSession(userId, ledgerId, transactionId, {
        clientRequestId: baseAttachment.clientRequestId,
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('给定附件不可见，当读取访问地址，则返回 40441', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findFirst.mockResolvedValue(null);

    await expect(d.service.getAccessUrl(userId, ledgerId, attachmentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('给定附件功能关闭，当创建会话，则返回 50341', async () => {
    const d = createService();
    (config.get as jest.Mock).mockImplementation((key: string) =>
      key === 'ATTACHMENT_ENABLED' ? 'false' : undefined,
    );

    await expect(
      d.service.createUploadSession(userId, ledgerId, transactionId, {
        clientRequestId: baseAttachment.clientRequestId,
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('给定附件可读，当读取访问地址，则返回短期签名地址', async () => {
    const d = createService();
    (config.get as jest.Mock).mockImplementation((key: string) =>
      key === 'ATTACHMENT_ENABLED' ? 'true' : '600',
    );
    d.prisma.transactionAttachment.findFirst.mockResolvedValue({
      id: attachmentId,
      objectKey: baseAttachment.objectKey,
      transaction: { deletedAt: null, account: { visibility: 'SHARED', ownerId: null } },
    });

    const result = await d.service.getAccessUrl(userId, ledgerId, attachmentId);

    expect(result.attachmentId).toBe(attachmentId);
    expect(result.accessUrl).toContain('read');
    expect(result.accessUrlExpiresAt).toBeInstanceOf(Date);
  });

  it('给定附件存在，当删除，则标记 DELETED 并写审计', async () => {
    const d = createService();
    (config.get as jest.Mock).mockImplementation((key: string) =>
      key === 'ATTACHMENT_ENABLED' ? 'true' : '600',
    );
    d.prisma.transactionAttachment.findFirst.mockResolvedValue({
      ...baseAttachment,
      transaction: { deletedAt: null },
    });

    const result = await d.service.remove(userId, ledgerId, transactionId, attachmentId);

    expect(result).toBeNull();
    expect(d.tx.transactionAttachment.update).toHaveBeenCalledWith({
      where: { id: attachmentId },
      data: expect.objectContaining({ status: 'DELETED' }),
    });
    expect(d.tx.transactionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ATTACHMENT_REMOVE' }) }),
    );
  });
});
