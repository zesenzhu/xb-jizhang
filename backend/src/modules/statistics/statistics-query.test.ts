import { BadRequestException } from '@nestjs/common';
import {
  buildStatisticsDayCountQuery,
  buildStatisticsPeriodAggregateQuery,
  buildStatisticsWhere,
} from './statistics-query';

const userId = 'user-1';
const ledgerId = 'ledger-1';

describe('statistics query builder', () => {
  it('给定任意统计请求，当构建基础 where，则限定账本、未删除收入支出和可见账户', () => {
    expect(buildStatisticsWhere(userId, ledgerId, {})).toEqual({
      ledgerId,
      deletedAt: null,
      type: { in: ['EXPENSE', 'INCOME'] },
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
      ],
    });
  });

  it('给定一级分类、账户、付款人、关键词和日期，当构建 where，则合并全部过滤并匹配一级与二级分类', () => {
    const occurredAt = {
      gte: new Date('2026-10-31T16:00:00.000Z'),
      lt: new Date('2026-11-30T16:00:00.000Z'),
    };

    expect(
      buildStatisticsWhere(
        userId,
        ledgerId,
        {
          categoryRootId: 'category-root',
          accountId: 'account-1',
          payerId: 'user-2',
          keyword: ' 早餐 ',
        },
        occurredAt,
      ),
    ).toEqual({
      ledgerId,
      deletedAt: null,
      type: { in: ['EXPENSE', 'INCOME'] },
      accountId: 'account-1',
      payerId: 'user-2',
      occurredAt,
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
            is: { ledgerMemberships: { some: { ledgerId, status: 'ACTIVE' } } },
          },
        },
        {
          OR: [
            { title: { contains: '早餐', mode: 'insensitive' } },
            { note: { contains: '早餐', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('给定精确分类 ID，当构建 where，则只匹配当前账本分类', () => {
    expect(
      buildStatisticsWhere(userId, ledgerId, { categoryId: 'category-1' }),
    ).toEqual(
      expect.objectContaining({
        categoryId: 'category-1',
        category: { ledgerId },
      }),
    );
  });

  it('给定同时传入精确分类和一级分类，当构建 where，则返回参数错误', () => {
    try {
      buildStatisticsWhere(userId, ledgerId, {
        categoryId: 'category-1',
        categoryRootId: 'category-root',
      });
      throw new Error('应拒绝互斥的分类参数');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 40021,
      });
    }
  });

  it('给定本地时区和统计过滤，当构建有效日查询，则使用参数化 SQL 并保留相同数据范围', () => {
    const query = buildStatisticsDayCountQuery(
      userId,
      ledgerId,
      {
        categoryId: 'category-1',
        accountId: 'account-1',
        payerId: 'user-2',
        keyword: '100% 早餐',
      },
      {
        gte: new Date('2026-10-31T16:00:00.000Z'),
        lt: new Date('2026-11-30T16:00:00.000Z'),
      },
      'America/New_York',
    );

    expect(query.sql).toContain(
      'COUNT(DISTINCT (t."occurred_at" AT TIME ZONE \'UTC\' AT TIME ZONE ?)::date)',
    );
    expect(query.sql).toContain('t."deleted_at" IS NULL');
    expect(query.sql).toContain("t.\"type\" IN ('EXPENSE', 'INCOME')");
    expect(query.sql).toContain('l."status" = \'ACTIVE\'');
    expect(query.values).toEqual(
      expect.arrayContaining([
        'America/New_York',
        ledgerId,
        userId,
        'account-1',
        'user-2',
        'category-1',
        '100% 早餐',
        new Date('2026-10-31T16:00:00.000Z'),
        new Date('2026-11-30T16:00:00.000Z'),
      ]),
    );
  });

  it('给定月粒度与完整过滤条件，当构建周期聚合 SQL，则按本地日期分组并安全绑定筛选值', () => {
    const query = buildStatisticsPeriodAggregateQuery(
      userId,
      ledgerId,
      {
        categoryRootId: 'category-root',
        accountId: 'account-1',
        payerId: 'user-2',
        keyword: '100% 早餐',
      },
      {
        gte: new Date('2026-10-31T16:00:00.000Z'),
        lt: new Date('2026-11-30T16:00:00.000Z'),
      },
      'America/New_York',
      'MONTH',
    );

    expect(query.sql).toContain('WITH bucketed AS');
    expect(query.sql.match(/DATE_TRUNC\(\?/g)).toHaveLength(1);
    expect(query.sql.match(/AT TIME ZONE 'UTC' AT TIME ZONE \?/g)).toHaveLength(1);
    expect(query.sql).toContain('GROUP BY "bucket"');
    expect(query.sql).not.toContain('GROUP BY DATE_TRUNC');
    expect(query.sql).toContain('t."deleted_at" IS NULL');
    expect(query.sql).toContain('a."visibility" = \'PRIVATE\'');
    expect(query.sql).toContain('l."status" = \'ACTIVE\'');
    expect(query.sql).toContain('POSITION(LOWER(?)');
    expect(query.values).toEqual(
      expect.arrayContaining([
        'month',
        'America/New_York',
        ledgerId,
        userId,
        'category-root',
        'account-1',
        'user-2',
        '100% 早餐',
        new Date('2026-10-31T16:00:00.000Z'),
        new Date('2026-11-30T16:00:00.000Z'),
      ]),
    );
  });
});
