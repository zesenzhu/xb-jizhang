import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    const prisma = {
      category: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      ledgerMember: { findUnique: jest.fn() },
    };

    return {
      prisma,
      service: new CategoryService(prisma as unknown as PrismaService),
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
    expect(result).toEqual(expect.objectContaining({ parentId: 'category-parent' }));
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
      dependencies.service.update(userId, ledgerId, 'category-1', { name: '新分类' }),
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
    dependencies.prisma.category.findUnique.mockResolvedValue({ ...category, name: '新餐饮' });

    const result = await dependencies.service.update(userId, ledgerId, 'category-1', {
      name: ' 新餐饮 ',
      sortOrder: 20,
      isActive: false,
      type: 'INCOME',
      isSystem: true,
    } as never);

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
      .mockResolvedValueOnce({ ...category, id: 'category-child-parent', parentId: 'category-parent' });

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
      dependencies.service.update(userId, ledgerId, 'category-1', { parentId: 'category-parent' }),
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
      dependencies.service.update(userId, ledgerId, 'category-1', { isActive: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.category.updateMany).not.toHaveBeenCalled();
  });
});
