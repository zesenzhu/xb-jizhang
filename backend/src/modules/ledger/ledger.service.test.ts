import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  const userId = 'user-1';
  const updatedAt = new Date('2026-10-30T08:00:00.000Z');

  const ledger = {
    id: 'ledger-1',
    name: '家庭账本',
    type: 'SHARED' as const,
    defaultCurrency: 'CNY',
    icon: null,
    color: null,
    isArchived: false,
    creatorId: userId,
    createdAt: updatedAt,
    updatedAt,
  };

  const createService = () => {
    const transactionClient = {
      ledger: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      ledgerMember: { create: jest.fn() },
      category: { createMany: jest.fn() },
    };
    const prisma = {
      ledger: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      ledgerMember: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    return {
      prisma,
      transactionClient,
      service: new LedgerService(prisma as unknown as PrismaService),
    };
  };

  it('给定用户拥有多个活跃账本，当查询账本列表，则只按成员关系返回账本角色', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findMany = jest.fn().mockResolvedValue([
      { role: 'OWNER', joinedAt: updatedAt, ledger },
    ]);
    dependencies.prisma.ledgerMember.count = jest.fn().mockResolvedValue(1);

    const result = await dependencies.service.list(userId, { page: 1, pageSize: 20 });

    expect(dependencies.prisma.ledgerMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: 'ACTIVE', ledger: { isArchived: false } },
      }),
    );
    expect(result).toEqual({
      items: [expect.objectContaining({ id: 'ledger-1', memberRole: 'OWNER' })],
      total: 1,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
    });
  });

  it('给定合法账本信息，当用户创建账本，则在同一事务写入账本和 Owner 成员关系', async () => {
    const dependencies = createService();
    dependencies.transactionClient.ledger.create.mockResolvedValue(ledger);
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({
      id: 'member-1',
      role: 'OWNER',
      joinedAt: updatedAt,
    });
    dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });

    const result = await dependencies.service.create(userId, {
      name: ' 家庭账本 ',
      type: 'SHARED',
      defaultCurrency: 'CNY',
    });

    expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: '家庭账本',
          type: 'SHARED',
          defaultCurrency: 'CNY',
          creatorId: userId,
        },
      }),
    );
    expect(dependencies.transactionClient.ledgerMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ledgerId: 'ledger-1', userId, role: 'OWNER', status: 'ACTIVE' },
      }),
    );
    expect(dependencies.transactionClient.category.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ ledgerId: 'ledger-1', type: 'EXPENSE', isSystem: true }),
          expect.objectContaining({ ledgerId: 'ledger-1', type: 'INCOME', isSystem: true }),
        ]),
      }),
    );
    const defaultCategories = dependencies.transactionClient.category.createMany.mock.calls[0][0].data;
    expect(defaultCategories).toHaveLength(65);
    expect(defaultCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '餐饮', parentId: null }),
        expect.objectContaining({ name: '早餐', parentId: expect.any(String) }),
      ]),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'ledger-1', memberRole: 'OWNER' }));
  });

  it('给定用户不是活跃成员，当读取账本详情，则返回资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue(null);

    await expect(dependencies.service.getDetail(userId, 'ledger-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dependencies.prisma.ledgerMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ledgerId_userId: { ledgerId: 'ledger-1', userId } } }),
    );
  });

  it('给定 Editor 访问账本设置，当修改账本资料，则拒绝越权操作', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });

    await expect(
      dependencies.service.update(userId, 'ledger-1', {
        name: '新名称',
        updatedAt,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('给定 Owner 使用旧版本，当修改账本资料，则返回并发冲突且不覆盖新数据', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue({ ...ledger, updatedAt: new Date('2026-10-30T09:00:00.000Z') });

    await expect(
      dependencies.service.update(userId, 'ledger-1', { name: '新名称', updatedAt }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });
});
