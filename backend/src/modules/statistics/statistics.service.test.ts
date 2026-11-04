import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';

  const createService = () => {
    const prisma = {
      ledgerMember: { findUnique: jest.fn() },
      transaction: { groupBy: jest.fn() },
    };
    return { prisma, service: new StatisticsService(prisma as unknown as PrismaService) };
  };

  it('给定活跃成员查询月份统计，当包含筛选条件，则按可见账户和未删除账单聚合收支', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.groupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amountCents: 3500 }, _count: { id: 1 } },
      { type: 'INCOME', _sum: { amountCents: 10000 }, _count: { id: 2 } },
    ]);

    const result = await dependencies.service.overview(userId, ledgerId, {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      type: undefined,
      categoryId: 'category-1',
      accountId: 'account-1',
      payerId: 'user-2',
      keyword: ' 早餐 ',
    });

    expect(dependencies.prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['type'],
      where: {
        ledgerId,
        deletedAt: null,
        type: { in: ['EXPENSE', 'INCOME'] },
        categoryId: 'category-1',
        accountId: 'account-1',
        payerId: 'user-2',
        occurredAt: {
          gte: new Date('2026-10-01T00:00:00.000Z'),
          lt: new Date('2026-11-01T00:00:00.000Z'),
        },
        AND: [
          {
            OR: [
              { accountId: null },
              { account: { OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }] } },
            ],
          },
          {
            OR: [
              { title: { contains: '早餐', mode: 'insensitive' } },
              { note: { contains: '早餐', mode: 'insensitive' } },
            ],
          },
        ],
      },
      _sum: { amountCents: true },
      _count: { id: true },
    });
    expect(result).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      totalIncomeCents: 10000,
      totalExpenseCents: 3500,
      netCents: 6500,
      transactionCount: 3,
    });
  });

  it('给定活跃成员查询无账单范围，当聚合为空，则返回零值统计', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.groupBy.mockResolvedValue([]);

    const result = await dependencies.service.overview(userId, ledgerId, {});

    expect(result).toEqual({
      from: null,
      to: null,
      totalIncomeCents: 0,
      totalExpenseCents: 0,
      netCents: 0,
      transactionCount: 0,
    });
  });

  it('给定非成员查询统计，当执行聚合，则返回资源不存在且不访问账单表', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue(null);

    await expect(dependencies.service.overview(userId, ledgerId, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.prisma.transaction.groupBy).not.toHaveBeenCalled();
  });

  it('给定统计时间范围无效，当查询概览，则返回参数错误且不执行聚合', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      dependencies.service.overview(userId, ledgerId, {
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.transaction.groupBy).not.toHaveBeenCalled();
  });

  it('给定只查询支出类型，当聚合返回收入分组时，则只返回支出筛选范围内的结果', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.groupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amountCents: 800 }, _count: { id: 1 } },
    ]);

    const result = await dependencies.service.overview(userId, ledgerId, { type: 'EXPENSE' });

    expect(dependencies.prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'EXPENSE' }) }),
    );
    expect(result).toEqual(expect.objectContaining({ totalIncomeCents: 0, totalExpenseCents: 800, netCents: -800 }));
  });
});
