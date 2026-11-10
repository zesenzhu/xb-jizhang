import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';
  const category = {
    id: 'category-1',
    ledgerId,
    type: 'EXPENSE' as const,
    name: '餐饮',
    icon: null,
    color: null,
    parentId: null,
    sortOrder: 10,
    isSystem: false,
    isActive: true,
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z'),
  };

  const createService = () => {
    const categoryIconService = {
      getBoundIconUrl: jest.fn().mockResolvedValue(null),
      validateBindableAsset: jest.fn().mockResolvedValue(undefined),
    };
    const transactionClient = {
      categoryIconAsset: { updateMany: jest.fn() },
      category: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const prisma = {
      category: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      categoryIconAsset: { updateMany: jest.fn() },
      ledgerMember: { findUnique: jest.fn() },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => unknown) =>
          callback(transactionClient),
      ),
    };
    return {
      prisma,
      transactionClient,
      categoryIconService,
      service: new CategoryService(
        prisma as unknown as PrismaService,
        categoryIconService as never,
      ),
    };
  };

  it('给定活跃成员，当查询启用分类，则按类型和排序返回当前账本分类', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findMany.mockResolvedValue([category]);
    dependencies.prisma.category.count.mockResolvedValue(1);

    const result = await dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      type: 'EXPENSE',
      includeInactive: false,
    });

    expect(dependencies.prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ledgerId, type: 'EXPENSE', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    );
    expect(result).toEqual({
      items: [category],
      total: 1,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
    });
  });

  it('给定 Editor 查询停用分类，当请求包含停用参数，则拒绝查看', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'EDITOR',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.list(userId, ledgerId, {
        page: 1,
        pageSize: 20,
        includeInactive: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('给定 Viewer 创建分类，当提交写请求，则拒绝越权操作', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.create(userId, ledgerId, {
        type: 'EXPENSE',
        name: '餐饮',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.prisma.category.create).not.toHaveBeenCalled();
  });

  it('给定 Owner 创建分类，当名称带空格且合法，则保存规范化后的分类', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.create.mockResolvedValue(category);

    const result = await dependencies.service.create(userId, ledgerId, {
      type: 'EXPENSE',
      name: ' 餐饮 ',
      sortOrder: 10,
    });

    expect(dependencies.prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ledgerId,
          type: 'EXPENSE',
          name: '餐饮',
          parentId: null,
          sortOrder: 10,
          isSystem: false,
        },
      }),
    );
    expect(result).toEqual(category);
  });

  it('给定同账本同类型分类名称已存在，当 Owner 创建分类，则返回冲突错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      dependencies.service.create(userId, ledgerId, {
        type: 'EXPENSE',
        name: '餐饮',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('给定同账本同类型一级分类，当 Owner 创建二级分类，则保存父级关系', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue({
      ...category,
      id: 'category-parent',
      name: '餐饮',
      parentId: null,
    });
    dependencies.prisma.category.create.mockResolvedValue({
      ...category,
      id: 'category-child',
      name: '早餐',
      parentId: 'category-parent',
    });

    const result = await dependencies.service.create(userId, ledgerId, {
      type: 'EXPENSE',
      name: ' 早餐 ',
      parentId: 'category-parent',
    });

    expect(dependencies.prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '早餐',
          parentId: 'category-parent',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ parentId: 'category-parent' }),
    );
  });

  it('给定跨账本或二级分类作为父级，当 Owner 创建分类，则拒绝并且不写入', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      dependencies.service.create(userId, ledgerId, {
        type: 'EXPENSE',
        name: '早餐',
        parentId: 'other-ledger-category',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.prisma.category.create).not.toHaveBeenCalled();

    dependencies.prisma.category.findFirst.mockResolvedValue({
      ...category,
      id: 'category-child-parent',
      parentId: 'category-parent',
    });
    await expect(
      dependencies.service.create(userId, ledgerId, {
        type: 'EXPENSE',
        name: '早餐',
        parentId: 'category-child-parent',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.category.create).not.toHaveBeenCalled();
  });

  it('给定其他账本的分类，当用户编辑分类，则返回资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      dependencies.service.update(userId, ledgerId, 'category-1', {
        name: '新分类',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.prisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('给定 Owner 编辑分类，当提交资料，则不能修改分类类型和系统标识', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.prisma.category.updateMany.mockResolvedValue({ count: 1 });
    dependencies.prisma.category.findUnique.mockResolvedValue({
      ...category,
      name: '新餐饮',
    });

    const result = await dependencies.service.update(
      userId,
      ledgerId,
      'category-1',
      {
        name: ' 新餐饮 ',
        sortOrder: 20,
        isActive: false,
        type: 'INCOME',
        isSystem: true,
      } as never,
    );

    expect(dependencies.prisma.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'category-1', ledgerId },
        data: { name: '新餐饮', sortOrder: 20, isActive: false },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ name: '新餐饮' }));
  });

  it('给定 Owner 把一级分类挂到二级父级，当编辑分类，则拒绝形成三级分类', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst
      .mockResolvedValueOnce(category)
      .mockResolvedValueOnce({
        ...category,
        id: 'category-child-parent',
        parentId: 'category-parent',
      });

    await expect(
      dependencies.service.update(userId, ledgerId, 'category-1', {
        parentId: 'category-child-parent',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('给定有子分类的一级分类，当 Owner 把它移动到另一个父级，则拒绝形成三级分类', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.prisma.category.count.mockResolvedValue(1);

    await expect(
      dependencies.service.update(userId, ledgerId, 'category-1', {
        parentId: 'category-parent',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('给定有启用子分类的一级分类，当 Owner 停用父级，则拒绝留下孤立可用子分类', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.prisma.category.count.mockResolvedValue(1);

    await expect(
      dependencies.service.update(userId, ledgerId, 'category-1', {
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('给定未列入白名单的图标键，当 Owner 创建分类，则拒绝非法图标组合', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.create(userId, ledgerId, {
        type: 'EXPENSE',
        name: '宠物',
        iconSource: 'LIBRARY',
        iconKey: 'tabler:unknown',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.category.create).not.toHaveBeenCalled();
  });

  it('给定已确认且同账本的图片资源，当 Owner 创建图片分类，则在事务中校验并绑定', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.transactionClient.category.create.mockResolvedValue({
      ...category,
      iconSource: 'IMAGE',
      iconKey: null,
      iconAssetId: 'asset-1',
      defaultKey: null,
    });

    const result = await dependencies.service.create(userId, ledgerId, {
      type: 'EXPENSE',
      name: '宠物',
      iconSource: 'IMAGE',
      iconAssetId: 'asset-1',
      color: '#F97316',
    });

    expect(
      dependencies.categoryIconService.validateBindableAsset,
    ).toHaveBeenCalledWith(
      dependencies.transactionClient,
      ledgerId,
      'asset-1',
      null,
    );
    expect(dependencies.prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ iconSource: 'IMAGE', iconAssetId: 'asset-1' }),
    );
  });

  it('给定图片分类资源可读取，当查询分类列表，则返回短期 iconUrl', async () => {
    const dependencies = createService();
    const imageCategory = {
      ...category,
      iconSource: 'IMAGE' as const,
      iconKey: null,
      iconAssetId: 'asset-1',
      defaultKey: null,
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findMany.mockResolvedValue([imageCategory]);
    dependencies.prisma.category.count.mockResolvedValue(1);
    dependencies.categoryIconService.getBoundIconUrl.mockResolvedValue({
      url: 'https://storage.example/icon.png',
      expiresAt: new Date('2026-11-10T08:05:00.000Z'),
    });

    const result = await dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      includeInactive: false,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        iconSource: 'IMAGE',
        iconAssetId: 'asset-1',
        iconUrl: 'https://storage.example/icon.png',
      }),
    );
  });

  it('给定系统分类存在默认键，当 Owner 恢复默认图标，则解除旧图片并恢复图标颜色', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.category.findFirst.mockResolvedValue({
      ...category,
      isSystem: true,
      defaultKey: 'expense.food',
      iconSource: 'IMAGE',
      iconKey: null,
      iconAssetId: 'asset-1',
    });
    dependencies.transactionClient.category.findUnique.mockResolvedValue({
      ...category,
      isSystem: true,
      defaultKey: 'expense.food',
      iconSource: 'LIBRARY',
      iconKey: 'tabler:tools-kitchen-2',
      iconAssetId: null,
      icon: 'tabler:tools-kitchen-2',
      color: '#F97316',
    });
    dependencies.transactionClient.category.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await dependencies.service.restoreDefaultIcon(
      userId,
      ledgerId,
      'category-1',
    );

    expect(
      dependencies.transactionClient.categoryIconAsset.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'asset-1', status: 'ATTACHED' } }),
    );
    expect(
      dependencies.transactionClient.category.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          iconSource: 'LIBRARY',
          iconKey: 'tabler:tools-kitchen-2',
          iconAssetId: null,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        iconSource: 'LIBRARY',
        iconKey: 'tabler:tools-kitchen-2',
      }),
    );
  });
});
