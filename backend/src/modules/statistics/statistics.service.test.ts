import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsService } from './statistics.service';
import type { StatisticsQuery } from './statistics.types';

describe('StatisticsService', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';

  const createService = () => {
    const prisma = {
      ledgerMember: { findUnique: jest.fn() },
      transaction: { findFirst: jest.fn(), groupBy: jest.fn() },
      $queryRaw: jest.fn(),
    };
    return {
      prisma,
      service: new StatisticsService(prisma as unknown as PrismaService),
    };
  };

  it('给定活跃成员查询月份统计，当包含筛选条件，则按可见账户和未删除账单聚合收支', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
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
        category: { ledgerId },
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
              {
                account: {
                  ledgerId,
                  OR: [
                    { visibility: 'SHARED' },
                    { visibility: 'PRIVATE', ownerId: userId },
                  ],
                },
              },
            ],
          },
          {
            payer: {
              is: {
                ledgerMemberships: { some: { ledgerId, status: 'ACTIVE' } },
              },
            },
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
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'EDITOR',
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
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

    await expect(
      dependencies.service.overview(userId, ledgerId, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.prisma.transaction.groupBy).not.toHaveBeenCalled();
  });

  it('给定统计时间范围无效，当查询概览，则返回参数错误且不执行聚合', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });

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
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.transaction.groupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amountCents: 800 }, _count: { id: 1 } },
    ]);

    const result = await dependencies.service.overview(userId, ledgerId, {
      type: 'EXPENSE',
    });

    expect(dependencies.prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'EXPENSE' }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        totalIncomeCents: 0,
        totalExpenseCents: 800,
        netCents: -800,
      }),
    );
  });

  it('给定自定义范围和筛选条件，当查询新版概览，则返回时区范围、有效日数和四舍五入日均支出', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.transaction.groupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amountCents: 3501 }, _count: { id: 1 } },
      { type: 'INCOME', _sum: { amountCents: 10000 }, _count: { id: 2 } },
    ]);
    dependencies.prisma.$queryRaw.mockResolvedValue([{ count: 2 }]);

    const result = await dependencies.service.overview(userId, ledgerId, {
      period: 'RANGE',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      granularity: 'DAY',
      categoryRootId: 'category-root',
      payerId: 'user-2',
      keyword: ' 早餐 ',
    });

    expect(result).toEqual({
      ledgerId,
      range: {
        period: 'RANGE',
        timezone: 'Asia/Shanghai',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
        startAt: '2026-09-30T16:00:00.000Z',
        endAt: '2026-10-31T16:00:00.000Z',
        granularity: 'DAY',
      },
      totalIncomeCents: 10000,
      totalExpenseCents: 3501,
      netCents: 6499,
      averageDailyExpenseCents: 1751,
      effectiveDayCount: 2,
      transactionCount: 3,
    });
    expect(dependencies.prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payerId: 'user-2',
          occurredAt: {
            gte: new Date('2026-09-30T16:00:00.000Z'),
            lt: new Date('2026-10-31T16:00:00.000Z'),
          },
          OR: [
            {
              categoryId: 'category-root',
              category: { ledgerId, parentId: null },
            },
            {
              category: {
                ledgerId,
                parentId: 'category-root',
                parent: { ledgerId, parentId: null },
              },
            },
          ],
        }),
      }),
    );
    expect(dependencies.prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(dependencies.prisma.transaction.findFirst).not.toHaveBeenCalled();
  });

  it('给定 ALL 范围没有当前用户可见账单，当查询概览，则返回空范围零值并跳过聚合', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(null);

    const result = await dependencies.service.overview(userId, ledgerId, {
      period: 'ALL',
    });

    expect(result).toEqual({
      ledgerId,
      range: {
        period: 'ALL',
        timezone: 'Asia/Shanghai',
        fromDate: null,
        toDate: null,
        startAt: null,
        endAt: null,
        granularity: 'YEAR',
      },
      totalIncomeCents: 0,
      totalExpenseCents: 0,
      netCents: 0,
      averageDailyExpenseCents: 0,
      effectiveDayCount: 0,
      transactionCount: 0,
    });
    expect(dependencies.prisma.transaction.groupBy).not.toHaveBeenCalled();
    expect(dependencies.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('给定未来自定义范围，当查询新版概览，则返回参数错误且不执行统计查询', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });

    await expect(
      dependencies.service.overview(userId, ledgerId, {
        period: 'RANGE',
        fromDate: '2099-12-30',
        toDate: '2099-12-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.transaction.groupBy).not.toHaveBeenCalled();
    expect(dependencies.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('给定 ALL 范围存在可见账单，当解析范围，则取不受其他筛选影响的首笔本地日期', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.transaction.findFirst.mockResolvedValue({
      occurredAt: new Date('2026-10-01T17:00:00.000Z'),
    });
    dependencies.prisma.transaction.groupBy.mockResolvedValue([]);
    dependencies.prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    const result = await dependencies.service.overview(userId, ledgerId, {
      period: 'ALL',
      keyword: '以后不影响起始日期',
      payerId: 'user-2',
    });

    expect(result).toEqual(
      expect.objectContaining({
        range: expect.objectContaining({
          fromDate: '2026-10-02',
          startAt: '2026-10-01T16:00:00.000Z',
        }),
      }),
    );
    expect(dependencies.prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ledgerId,
        deletedAt: null,
        type: { in: ['EXPENSE', 'INCOME'] },
      }),
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true },
    });
  });

  it('给定趋势中间周期没有账单，当查询净额趋势，则返回连续周期和零值项', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.$queryRaw.mockResolvedValue([
      {
        periodStart: '2026-10-01',
        expenseCents: 1000,
        incomeCents: 500,
        transactionCount: 2,
      },
      {
        periodStart: '2026-10-03',
        expenseCents: 100,
        incomeCents: 800,
        transactionCount: 2,
      },
    ]);

    const trend = (dependencies.service as unknown as Record<string, unknown>)
      .trend;
    expect(trend).toEqual(expect.any(Function));
    if (typeof trend !== 'function') return;
    const result = await trend.call(dependencies.service, userId, ledgerId, {
      period: 'RANGE',
      fromDate: '2026-10-01',
      toDate: '2026-10-03',
      granularity: 'DAY',
      metric: 'NET',
    });

    expect(result).toEqual({
      ledgerId,
      range: {
        period: 'RANGE',
        timezone: 'Asia/Shanghai',
        fromDate: '2026-10-01',
        toDate: '2026-10-03',
        startAt: '2026-09-30T16:00:00.000Z',
        endAt: '2026-10-03T16:00:00.000Z',
        granularity: 'DAY',
      },
      hasData: true,
      items: [
        {
          fromDate: '2026-10-01',
          toDate: '2026-10-01',
          valueCents: -500,
          expenseCents: 1000,
          incomeCents: 500,
          netCents: -500,
          transactionCount: 2,
          drilldown: {
            from: '2026-09-30T16:00:00.000Z',
            to: '2026-10-01T16:00:00.000Z',
          },
        },
        {
          fromDate: '2026-10-02',
          toDate: '2026-10-02',
          valueCents: 0,
          expenseCents: 0,
          incomeCents: 0,
          netCents: 0,
          transactionCount: 0,
          drilldown: {
            from: '2026-10-01T16:00:00.000Z',
            to: '2026-10-02T16:00:00.000Z',
          },
        },
        {
          fromDate: '2026-10-03',
          toDate: '2026-10-03',
          valueCents: 700,
          expenseCents: 100,
          incomeCents: 800,
          netCents: 700,
          transactionCount: 2,
          drilldown: {
            from: '2026-10-02T16:00:00.000Z',
            to: '2026-10-03T16:00:00.000Z',
          },
        },
      ],
    });
    expect(dependencies.prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('给定趋势范围没有可见账单，当查询趋势，则返回 hasData=false 和空数组', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.$queryRaw.mockResolvedValue([]);

    const trend = (dependencies.service as unknown as Record<string, unknown>)
      .trend;
    expect(trend).toEqual(expect.any(Function));
    if (typeof trend !== 'function') return;
    const result = await trend.call(dependencies.service, userId, ledgerId, {
      period: 'RANGE',
      fromDate: '2026-10-01',
      toDate: '2026-10-02',
    });

    expect(result).toEqual(
      expect.objectContaining({ hasData: false, items: [] }),
    );
  });

  it('给定部分月份含账单且中间月无账单，当查询周期汇总，则裁剪首尾并补零周期', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          periodStart: '2025-10-01',
          expenseCents: 1200,
          incomeCents: 0,
          transactionCount: 2,
        },
        {
          periodStart: '2025-12-01',
          expenseCents: 0,
          incomeCents: 3000,
          transactionCount: 1,
        },
      ])
      .mockResolvedValueOnce([{ count: 2 }]);

    const periods = (dependencies.service as unknown as Record<string, unknown>)
      .periods;
    expect(periods).toEqual(expect.any(Function));
    if (typeof periods !== 'function') return;
    const result = await periods.call(dependencies.service, userId, ledgerId, {
      period: 'RANGE',
      fromDate: '2025-10-30',
      toDate: '2025-12-02',
      granularity: 'MONTH',
    });

    expect(result).toEqual({
      ledgerId,
      range: {
        period: 'RANGE',
        timezone: 'Asia/Shanghai',
        fromDate: '2025-10-30',
        toDate: '2025-12-02',
        startAt: '2025-10-29T16:00:00.000Z',
        endAt: '2025-12-02T16:00:00.000Z',
        granularity: 'MONTH',
      },
      summary: {
        totalIncomeCents: 3000,
        totalExpenseCents: 1200,
        netCents: 1800,
        averageDailyExpenseCents: 600,
        effectiveDayCount: 2,
        transactionCount: 3,
      },
      items: [
        {
          fromDate: '2025-10-30',
          toDate: '2025-10-31',
          expenseCents: 1200,
          incomeCents: 0,
          netCents: -1200,
          transactionCount: 2,
          drilldown: {
            from: '2025-10-29T16:00:00.000Z',
            to: '2025-10-31T16:00:00.000Z',
          },
        },
        {
          fromDate: '2025-11-01',
          toDate: '2025-11-30',
          expenseCents: 0,
          incomeCents: 0,
          netCents: 0,
          transactionCount: 0,
          drilldown: {
            from: '2025-10-31T16:00:00.000Z',
            to: '2025-11-30T16:00:00.000Z',
          },
        },
        {
          fromDate: '2025-12-01',
          toDate: '2025-12-02',
          expenseCents: 0,
          incomeCents: 3000,
          netCents: 3000,
          transactionCount: 1,
          drilldown: {
            from: '2025-11-30T16:00:00.000Z',
            to: '2025-12-02T16:00:00.000Z',
          },
        },
      ],
    });
    expect(dependencies.prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('给定无数据的周范围，当查询周期汇总，则仍返回完整零值行', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }]);

    const periods = (dependencies.service as unknown as Record<string, unknown>)
      .periods;
    expect(periods).toEqual(expect.any(Function));
    if (typeof periods !== 'function') return;
    const result = await periods.call(dependencies.service, userId, ledgerId, {
      period: 'WEEK',
      anchorDate: '2026-10-14',
    });

    expect(result.summary).toEqual({
      totalIncomeCents: 0,
      totalExpenseCents: 0,
      netCents: 0,
      averageDailyExpenseCents: 0,
      effectiveDayCount: 0,
      transactionCount: 0,
    });
    expect(result.items).toHaveLength(7);
    expect(
      result.items.every(
        (item: { transactionCount: number }) => item.transactionCount === 0,
      ),
    ).toBe(true);
  });

  it('给定 ALL 趋势带有关键词筛选，当解析起点，则仍使用首笔可见账单日期', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      ledger: { timezone: 'Asia/Shanghai' },
    });
    dependencies.prisma.transaction.findFirst.mockResolvedValue({
      occurredAt: new Date('2026-10-01T17:00:00.000Z'),
    });
    dependencies.prisma.$queryRaw.mockResolvedValue([]);

    const trend = (dependencies.service as unknown as Record<string, unknown>)
      .trend;
    expect(trend).toEqual(expect.any(Function));
    if (typeof trend !== 'function') return;
    const result = await trend.call(dependencies.service, userId, ledgerId, {
      period: 'ALL',
      keyword: '不影响范围起点',
      granularity: 'YEAR',
    });

    expect(result.range).toEqual(
      expect.objectContaining({
        fromDate: '2026-10-02',
        startAt: '2026-10-01T16:00:00.000Z',
      }),
    );
    expect(dependencies.prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ledgerId }) }),
    );
  });
});

describe('StatisticsService categories', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';
  const baseQuery = { period: 'MONTH', anchorDate: '2026-10-15' };
  const root = {
    id: 'root',
    ledgerId,
    type: 'EXPENSE',
    parentId: null,
    name: 'Food',
    icon: 'food',
    color: '#123456',
    isActive: false,
  };
  const child = { ...root, id: 'child', parentId: root.id, name: 'Lunch' };
  const other = { ...root, id: 'other', name: 'Travel', isActive: true };
  const group = (
    categoryId: string | null,
    amountCents: number,
    count = 1,
  ) => ({ categoryId, _sum: { amountCents }, _count: { id: count } });
  const setup = (timezone = 'Asia/Shanghai') => {
    const prisma = {
      ledgerMember: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          role: 'VIEWER',
          ledger: { timezone },
        }),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue(root),
        findMany: jest.fn().mockResolvedValue([root, child, other]),
      },
      transaction: {
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    return {
      prisma,
      service: new StatisticsService(prisma as unknown as PrismaService),
    };
  };
  const categories = (
    service: StatisticsService,
    query: Record<string, unknown> = baseQuery,
  ) => service.categories(userId, ledgerId, query as StatisticsQuery);

  it('给定一级直记、多个二级与未分类历史账单，当查询 ROOT，则合并停用分类树并返回金额、账单数和下钻', async () => {
    const { prisma, service } = setup();
    prisma.category.findMany.mockResolvedValue([
      root,
      child,
      { ...child, id: 'child-2' },
      other,
    ]);
    prisma.transaction.groupBy.mockResolvedValue([
      group('root', 100, 2),
      group('child', 200),
      group('child-2', 300),
      group(null, 300),
    ]);
    const result = await categories(service);
    expect(result).toEqual(
      expect.objectContaining({
        ledgerId,
        type: 'EXPENSE',
        totalCents: 900,
        comparisonRange: null,
        items: [
          {
            categoryId: 'root',
            categoryRootId: 'root',
            parentId: null,
            bucketType: 'CATEGORY',
            name: 'Food',
            icon: 'food',
            color: '#123456',
            amountCents: 600,
            percentage: 66.67,
            transactionCount: 4,
            comparison: null,
            drilldown: {
              categoryRootId: 'root',
              from: '2026-09-30T16:00:00.000Z',
              to: '2026-10-31T16:00:00.000Z',
              type: 'EXPENSE',
            },
          },
          {
            categoryId: null,
            categoryRootId: null,
            parentId: null,
            bucketType: 'UNCATEGORIZED',
            name: '未分类',
            icon: null,
            color: null,
            amountCents: 300,
            percentage: 33.33,
            transactionCount: 1,
            comparison: null,
            drilldown: {
              uncategorized: true,
              from: '2026-09-30T16:00:00.000Z',
              to: '2026-10-31T16:00:00.000Z',
              type: 'EXPENSE',
            },
          },
        ],
      }),
    );
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ledgerId, type: 'EXPENSE' } }),
    );
  });

  it.each(['ROOT', 'CHILD'])(
    '给定选定一级分类，当查询 %s，则仅统计分类树并为直记账单提供精确下钻',
    async (categoryLevel) => {
      const { prisma, service } = setup();
      prisma.transaction.groupBy.mockResolvedValue([
        group('root', 100),
        group('child', 300),
      ]);
      const result = await categories(service, {
        ...baseQuery,
        categoryLevel,
        categoryRootId: 'root',
      });
      expect(result.totalCents).toBe(400);
      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'root', ledgerId, type: 'EXPENSE', parentId: null },
        }),
      );
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                categoryId: 'root',
                category: { ledgerId, parentId: null },
              },
              {
                category: {
                  ledgerId,
                  parentId: 'root',
                  parent: { ledgerId, parentId: null },
                },
              },
            ],
          }),
        }),
      );
      expect(result.items).toEqual(
        categoryLevel === 'ROOT'
          ? [
              expect.objectContaining({
                categoryId: 'root',
                amountCents: 400,
                transactionCount: 2,
              }),
            ]
          : [
              expect.objectContaining({
                categoryId: 'child',
                categoryRootId: 'root',
                parentId: 'root',
                bucketType: 'CATEGORY',
                amountCents: 300,
                percentage: 75,
                drilldown: expect.objectContaining({
                  categoryId: 'child',
                }),
              }),
              expect.objectContaining({
                categoryId: 'root',
                parentId: null,
                bucketType: 'ROOT_DIRECT',
                name: 'Food（未细分）',
                amountCents: 100,
                percentage: 25,
                drilldown: expect.objectContaining({ categoryId: 'root' }),
              }),
            ],
      );
    },
  );

  it.each([
    ['AMOUNT', 'DESC', ['other', 'a', 'z']],
    ['AMOUNT', 'ASC', ['a', 'z', 'other']],
    ['PERCENTAGE', 'DESC', ['other', 'a', 'z']],
    ['PERCENTAGE', 'ASC', ['a', 'z', 'other']],
  ])(
    '给定金额相同且重名的分类，当按 %s %s 排序，则按名称及 ID 稳定排序',
    async (sortBy, sortOrder, ids) => {
      const { prisma, service } = setup();
      prisma.category.findMany.mockResolvedValue([
        { ...root, id: 'z' },
        other,
        { ...root, id: 'a' },
      ]);
      prisma.transaction.groupBy.mockResolvedValue([
        group('z', 100),
        group('other', 200),
        group('a', 100),
      ]);
      const result = await categories(service, {
        ...baseQuery,
        sortBy,
        sortOrder,
      });
      expect(result.items.map((item) => item.categoryId)).toEqual(ids);
    },
  );

  it('给定无账单或零金额分类，当查询分类，则不合成空分类且总额与占比为零', async () => {
    const { prisma, service } = setup();
    expect(await categories(service)).toEqual(
      expect.objectContaining({ totalCents: 0, items: [] }),
    );
    prisma.transaction.groupBy.mockResolvedValue([group('root', 0)]);
    expect(await categories(service)).toEqual(
      expect.objectContaining({ totalCents: 0, items: [] }),
    );
  });

  it('给定两期各自缺少分类，当查询环比，则保留上期分类并以零补缺计算百分点差', async () => {
    const { prisma, service } = setup();
    prisma.transaction.groupBy
      .mockResolvedValueOnce([group('root', 300)])
      .mockResolvedValueOnce([group('other', 100), group('root', 100)]);
    const result = await categories(service, {
      ...baseQuery,
      includeComparison: true,
    });
    expect(result.comparisonRange).toEqual({
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        categoryId: 'root',
        comparison: {
          amountCents: 100,
          amountDeltaCents: 200,
          percentagePointDelta: 50,
        },
      }),
      expect.objectContaining({
        categoryId: 'other',
        amountCents: 0,
        percentage: 0,
        transactionCount: 0,
        comparison: {
          amountCents: 100,
          amountDeltaCents: -100,
          percentagePointDelta: -50,
        },
      }),
    ]);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([group('root', 300)])
      .mockResolvedValueOnce([]);
    expect(
      (
        await categories(service, {
          ...baseQuery,
          includeComparison: true,
        })
      ).items[0].comparison,
    ).toEqual({
      amountCents: 0,
      amountDeltaCents: 300,
      percentagePointDelta: null,
    });
  });

  it('给定本期空数据且上期有直记和未分类，当查询环比，则保留对比桶且零总额占比为零', async () => {
    const { prisma, service } = setup();
    prisma.transaction.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([group('root', 100), group(null, 100)]);
    const result = await categories(service, {
      ...baseQuery,
      includeComparison: true,
    });
    expect(result.totalCents).toBe(0);
    expect(result.items).toEqual([
      expect.objectContaining({
        categoryId: 'root',
        percentage: 0,
        comparison: {
          amountCents: 100,
          amountDeltaCents: -100,
          percentagePointDelta: -50,
        },
      }),
      expect.objectContaining({ categoryId: null, percentage: 0 }),
    ]);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([group('root', 100)]);
    expect(
      (
        await categories(service, {
          ...baseQuery,
          categoryLevel: 'CHILD',
          categoryRootId: 'root',
          includeComparison: true,
        })
      ).items,
    ).toEqual([
      expect.objectContaining({
        bucketType: 'ROOT_DIRECT',
        percentage: 0,
      }),
    ]);
  });

  it.each([
    [
      { period: 'WEEK', anchorDate: '2026-03-09' },
      '2026-03-02',
      '2026-03-08',
      '2026-03-02T05:00:00.000Z',
      '2026-03-09T04:00:00.000Z',
    ],
    [
      { period: 'MONTH', anchorDate: '2024-03-31' },
      '2024-02-01',
      '2024-02-29',
      '2024-02-01T05:00:00.000Z',
      '2024-03-01T05:00:00.000Z',
    ],
    [
      { period: 'YEAR', anchorDate: '2024-06-01' },
      '2023-01-01',
      '2023-12-31',
      '2023-01-01T05:00:00.000Z',
      '2024-01-01T05:00:00.000Z',
    ],
    [
      { period: 'RANGE', fromDate: '2026-03-09', toDate: '2026-03-11' },
      '2026-03-06',
      '2026-03-08',
      '2026-03-06T05:00:00.000Z',
      '2026-03-09T04:00:00.000Z',
    ],
  ])(
    '给定周期 %j 和夏令时时区，当请求对比，则使用相邻本地周期的独立 UTC 边界',
    async (query, fromDate, toDate, startAt, endAt) => {
      const { prisma, service } = setup('America/New_York');
      const result = await categories(service, {
        ...query,
        includeComparison: true,
      });
      expect(result.comparisonRange).toEqual({ fromDate, toDate });
      expect(prisma.transaction.groupBy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { gte: new Date(startAt), lt: new Date(endAt) },
          }),
        }),
      );
    },
  );

  it('给定公共过滤条件，当查询收入及环比，则两期均保留账本、私有账户、软删除、活跃付款人和关键词限制', async () => {
    const { prisma, service } = setup();
    await categories(service, {
      ...baseQuery,
      type: 'INCOME',
      includeComparison: true,
      accountId: 'account-1',
      payerId: 'payer-1',
      keyword: ' Lunch ',
    });
    expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(2);
    for (const [args] of prisma.transaction.groupBy.mock.calls as Array<
      [{ where: unknown }]
    >) {
      expect(args.where).toEqual(
        expect.objectContaining({
          ledgerId,
          deletedAt: null,
          type: 'INCOME',
          accountId: 'account-1',
          payerId: 'payer-1',
          AND: [
            {
              OR: [
                { accountId: null },
                {
                  account: {
                    ledgerId,
                    OR: [
                      { visibility: 'SHARED' },
                      { visibility: 'PRIVATE', ownerId: userId },
                    ],
                  },
                },
              ],
            },
            {
              payer: {
                is: {
                  ledgerMemberships: {
                    some: { ledgerId, status: 'ACTIVE' },
                  },
                },
              },
            },
            {
              OR: [
                { title: { contains: 'Lunch', mode: 'insensitive' } },
                { note: { contains: 'Lunch', mode: 'insensitive' } },
              ],
            },
          ],
        }),
      );
    }
  });

  it.each([null, { status: 'INACTIVE' }])(
    '给定非活跃成员 %j，当查询分类，则返回 40421 且不读取分类或账单',
    async (member) => {
      const { prisma, service } = setup();
      prisma.ledgerMember.findUnique.mockResolvedValue(member);
      await expect(categories(service)).rejects.toMatchObject({
        response: { code: 40421 },
      });
      expect(prisma.category.findMany).not.toHaveBeenCalled();
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    },
  );

  it.each(['foreign-root', 'income-root', 'child'])(
    '给定跨账本、类型错误或非一级分类 %s，当下钻，则返回 40421 且不聚合',
    async (categoryRootId) => {
      const { prisma, service } = setup();
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(
        categories(service, {
          ...baseQuery,
          categoryLevel: 'CHILD',
          categoryRootId,
        }),
      ).rejects.toMatchObject({ response: { code: 40421 } });
      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: categoryRootId,
            ledgerId,
            type: 'EXPENSE',
            parentId: null,
          },
        }),
      );
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ categoryLevel: 'CHILD' }, 40023],
    [{ categoryId: 'child', categoryRootId: 'root' }, 40023],
    [{ categoryId: 'child' }, 40021],
    [{ period: 'ALL', anchorDate: undefined, includeComparison: true }, 40021],
    [{ type: 'TRANSFER' }, 40021],
    [{ categoryLevel: 'LEAF' }, 40021],
    [{ sortBy: 'NAME' }, 40021],
    [{ sortOrder: 'UP' }, 40021],
    [{ includeComparison: 'false' }, 40021],
    [
      {
        period: 'RANGE',
        anchorDate: undefined,
        fromDate: '2099-01-01',
        toDate: '2099-01-02',
      },
      40021,
    ],
  ])(
    '给定非法分类参数 %j，当查询分类，则返回 %s 且不聚合',
    async (query, code) => {
      const { prisma, service } = setup();
      await expect(
        categories(service, { ...baseQuery, ...query }),
      ).rejects.toMatchObject({ response: { code } });
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    },
  );

  it('给定 ALL 无可见账单，当查询分类，则返回空范围并跳过聚合', async () => {
    const { prisma, service } = setup();
    const result = await categories(service, { period: 'ALL' });
    expect(result).toEqual(
      expect.objectContaining({
        totalCents: 0,
        comparisonRange: null,
        items: [],
        range: expect.objectContaining({ fromDate: null, startAt: null }),
      }),
    );
    expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
  });
});
