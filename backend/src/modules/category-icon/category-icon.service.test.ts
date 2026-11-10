import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { ObjectStoragePort } from '../attachment/object-storage/object-storage.port';
import { CategoryIconService } from './category-icon.service';

describe('CategoryIconService', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const ledgerId = 'ledger-1';
  const assetId = 'asset-1';
  const clientRequestId = '9d0e8400-e29b-41d4-a716-446655440000';
  const createdAt = new Date('2026-11-10T08:00:00.000Z');
  const uploadExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const asset = {
    id: assetId,
    ledgerId,
    uploadedById: userId,
    clientRequestId,
    objectKey: `ledgers/${ledgerId}/category-icons/${assetId}.png`,
    originalName: 'category.png',
    declaredMimeType: 'image/png',
    declaredSizeBytes: 18_342,
    mimeType: 'image/png',
    sizeBytes: 18_342,
    status: 'ATTACHED' as const,
    uploadExpiresAt,
    orphanExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    uploadedAt: createdAt,
    deletedAt: null,
    purgedAt: null,
    createdAt,
    updatedAt: createdAt,
    category: { id: 'category-1' },
  };

  const createService = (enabled = 'true') => {
    const transactionClient = {
      $queryRaw: jest.fn(),
      categoryIconAsset: {
        findUnique: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      ledgerMember: { findUnique: jest.fn() },
      categoryIconAsset: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => unknown) =>
          callback(transactionClient),
      ),
    };
    const storage: jest.Mocked<ObjectStoragePort> = {
      createUploadUrl: jest.fn(),
      headObject: jest.fn(),
      readPrefix: jest.fn(),
      createDownloadUrl: jest.fn(),
      deleteObject: jest.fn(),
      ensureCors: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'CATEGORY_ICON_ENABLED') return enabled;
        return undefined;
      }),
    } as unknown as ConfigService;
    return {
      prisma,
      transactionClient,
      storage,
      service: new CategoryIconService(
        prisma as unknown as PrismaService,
        config,
        storage,
      ),
    };
  };

  const validInput = {
    clientRequestId,
    fileName: 'category.png',
    mimeType: 'image/png' as const,
    sizeBytes: 18_342,
  };

  it('给定活跃账本成员，当查询图标库，则按类型和关键字返回白名单项', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    const result = await dependencies.service.listLibrary(userId, ledgerId, {
      page: 1,
      pageSize: 10,
      type: 'EXPENSE',
      q: '公交',
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        key: 'tabler:bus',
        label: '公交',
        defaultTypes: ['EXPENSE'],
      }),
    ]);
    expect(result.total).toBe(1);
  });

  it('给定 Viewer，当创建分类图标上传会话，则拒绝且不创建资源', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.createUploadSession(userId, ledgerId, validInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定 Owner 和合法图片，当创建上传会话，则使用分类图标前缀并返回 PUT 地址', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.transactionClient.$queryRaw.mockResolvedValue([
      { id: ledgerId },
    ]);
    dependencies.transactionClient.categoryIconAsset.findUnique.mockResolvedValue(
      null,
    );
    dependencies.transactionClient.categoryIconAsset.aggregate
      .mockResolvedValueOnce({ _sum: { declaredSizeBytes: null } })
      .mockResolvedValueOnce({ _sum: { sizeBytes: null } });
    dependencies.transactionClient.categoryIconAsset.create.mockResolvedValue({
      ...asset,
      status: 'PENDING',
      mimeType: null,
      sizeBytes: null,
      uploadedAt: null,
      category: null,
    });
    dependencies.storage.createUploadUrl.mockResolvedValue({
      url: 'http://localhost:9000/upload',
      headers: { 'Content-Type': 'image/png' },
      expiresAt: uploadExpiresAt,
    });

    const result = await dependencies.service.createUploadSession(
      userId,
      ledgerId,
      validInput,
    );

    expect(
      dependencies.transactionClient.categoryIconAsset.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ledgerId,
          uploadedById: userId,
          objectKey: expect.stringMatching(
            new RegExp(`^ledgers/${ledgerId}/category-icons/.+\\.png$`),
          ),
        }),
      }),
    );
    expect(result).toEqual({
      reused: false,
      asset: expect.objectContaining({
        status: 'PENDING',
        uploadMethod: 'PUT',
        uploadUrl: 'http://localhost:9000/upload',
      }),
    });
  });

  it('给定对象已上传且文件头为 PNG，当完成上传，则置为 ATTACHED 并签发读取地址', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.categoryIconAsset.findFirst.mockResolvedValue({
      ...asset,
      status: 'PENDING',
      mimeType: null,
      sizeBytes: null,
      uploadedAt: null,
      category: null,
    });
    dependencies.storage.headObject.mockResolvedValue({
      contentLength: 18_342,
      contentType: 'image/png',
      etag: 'etag',
    });
    dependencies.storage.readPrefix.mockResolvedValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    dependencies.transactionClient.categoryIconAsset.updateMany.mockResolvedValue(
      { count: 1 },
    );
    dependencies.transactionClient.categoryIconAsset.findUnique.mockResolvedValue(
      asset,
    );
    dependencies.storage.createDownloadUrl.mockResolvedValue(
      'http://localhost:9000/read',
    );

    const result = await dependencies.service.complete(
      userId,
      ledgerId,
      assetId,
    );

    expect(
      dependencies.transactionClient.categoryIconAsset.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: assetId, ledgerId, status: 'PENDING' },
        data: expect.objectContaining({
          status: 'ATTACHED',
          mimeType: 'image/png',
          sizeBytes: 18_342,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        assetId,
        status: 'ATTACHED',
        accessUrl: 'http://localhost:9000/read',
      }),
    );
  });

  it('给定对象文件头与声明 MIME 不一致，当完成上传，则拒绝并记录错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.categoryIconAsset.findFirst.mockResolvedValue({
      ...asset,
      status: 'PENDING',
      mimeType: null,
      sizeBytes: null,
      uploadedAt: null,
      category: null,
    });
    dependencies.storage.headObject.mockResolvedValue({
      contentLength: 18_342,
      contentType: 'image/png',
      etag: null,
    });
    dependencies.storage.readPrefix.mockResolvedValue(
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    );

    await expect(
      dependencies.service.complete(userId, ledgerId, assetId),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(
      dependencies.prisma.categoryIconAsset.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastUploadError: expect.any(String) }),
      }),
    );
  });

  it('给定已确认但未绑定分类的资源，当非上传者申请读取地址，则返回不可见', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });
    dependencies.prisma.categoryIconAsset.findFirst.mockResolvedValue({
      ...asset,
      uploadedById: otherUserId,
      category: null,
    });

    await expect(
      dependencies.service.getAccessUrl(userId, ledgerId, assetId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.storage.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('给定过期待上传资源，当执行清理，则删除对象并标记已清理', async () => {
    const dependencies = createService();
    dependencies.prisma.categoryIconAsset.findMany.mockResolvedValue([
      { id: assetId, objectKey: asset.objectKey, status: 'PENDING' },
    ]);
    dependencies.prisma.categoryIconAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      dependencies.service.cleanupExpiredAndDeleted(),
    ).resolves.toEqual({ cleaned: 1, failed: 0 });
    expect(dependencies.storage.deleteObject).toHaveBeenCalledWith(
      asset.objectKey,
    );
    expect(
      dependencies.prisma.categoryIconAsset.updateMany,
    ).toHaveBeenCalledTimes(2);
  });

  it('给定分类图标功能关闭，当创建上传会话，则返回对象存储不可用', async () => {
    const dependencies = createService('false');

    await expect(
      dependencies.service.createUploadSession(userId, ledgerId, validInput),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(dependencies.prisma.ledgerMember.findUnique).not.toHaveBeenCalled();
  });

  it('给定重复请求已有过期会话，当再次创建上传会话，则返回冲突', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.transactionClient.$queryRaw.mockResolvedValue([
      { id: ledgerId },
    ]);
    dependencies.transactionClient.categoryIconAsset.findUnique.mockResolvedValue(
      {
        ...asset,
        status: 'PENDING',
        uploadExpiresAt: new Date(Date.now() - 1000),
        category: null,
      },
    );

    await expect(
      dependencies.service.createUploadSession(userId, ledgerId, validInput),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
