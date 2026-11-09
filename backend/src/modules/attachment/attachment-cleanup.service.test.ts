import { ConfigService } from '@nestjs/config';
import type { ObjectStoragePort } from './object-storage/object-storage.port';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentCleanupService } from './attachment-cleanup.service';

describe('AttachmentCleanupService', () => {
  const storage: ObjectStoragePort = {
    createUploadUrl: jest.fn(),
    createDownloadUrl: jest.fn(),
    headObject: jest.fn(),
    readPrefix: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    ensureCors: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => (key === 'ATTACHMENT_ENABLED' ? 'true' : '600')),
  } as unknown as ConfigService;

  const createService = () => {
    const prisma = {
      transactionAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    return {
      prisma,
      service: new AttachmentCleanupService(prisma as unknown as PrismaService, config, storage),
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('给定过期 PENDING，当清理，则标记 DELETED 并删除对象', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findMany
      .mockResolvedValueOnce([{ id: 'a1', objectKey: 'k1' }])
      .mockResolvedValueOnce([]);

    await d.service.cleanupOnce();

    expect(d.prisma.transactionAttachment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'DELETED' }),
    });
    expect(storage.deleteObject).toHaveBeenCalledWith('k1');
  });

  it('给定对象删除失败，当清理已删除附件，则记录重试次数和错误', async () => {
    const d = createService();
    d.prisma.transactionAttachment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'a2', objectKey: 'k2' }]);
    (storage.deleteObject as jest.Mock).mockRejectedValueOnce(new Error('network'));

    await d.service.cleanupOnce();

    expect(d.prisma.transactionAttachment.update).toHaveBeenCalledWith({
      where: { id: 'a2' },
      data: expect.objectContaining({ purgeAttempts: { increment: 1 } }),
    });
  });
});
