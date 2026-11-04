import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StatisticsQuery } from './statistics.types';

export interface StatisticsOccurredAtFilter {
  gte?: Date;
  lt?: Date;
}

interface NormalizedStatisticsFilters {
  type?: StatisticsQuery['type'];
  categoryId?: string;
  categoryRootId?: string;
  accountId?: string;
  payerId?: string;
  keyword?: string;
}

function normalizeFilters(query: StatisticsQuery): NormalizedStatisticsFilters {
  if (query.categoryId !== undefined && query.categoryRootId !== undefined) {
    throw new BadRequestException({
      code: 40021,
      message: '统计参数不合法',
      data: null,
    });
  }
  const keyword = query.keyword?.trim();
  return {
    ...(query.type === undefined ? {} : { type: query.type }),
    ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
    ...(query.categoryRootId === undefined
      ? {}
      : { categoryRootId: query.categoryRootId }),
    ...(query.accountId === undefined ? {} : { accountId: query.accountId }),
    ...(query.payerId === undefined ? {} : { payerId: query.payerId }),
    ...(keyword ? { keyword } : {}),
  };
}

function visibilityCondition(
  userId: string,
  ledgerId: string,
): Prisma.TransactionWhereInput {
  return {
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
  };
}

export function buildStatisticsWhere(
  userId: string,
  ledgerId: string,
  query: StatisticsQuery,
  occurredAt?: StatisticsOccurredAtFilter,
): Prisma.TransactionWhereInput {
  const filters = normalizeFilters(query);
  const and: Prisma.TransactionWhereInput[] = [
    visibilityCondition(userId, ledgerId),
  ];
  if (filters.payerId !== undefined) {
    and.push({
      payer: {
        is: { ledgerMemberships: { some: { ledgerId, status: 'ACTIVE' } } },
      },
    });
  }
  if (filters.keyword !== undefined) {
    and.push({
      OR: [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { note: { contains: filters.keyword, mode: 'insensitive' } },
      ],
    });
  }

  return {
    ledgerId,
    deletedAt: null,
    type: filters.type ?? { in: ['EXPENSE', 'INCOME'] },
    ...(filters.categoryId === undefined
      ? {}
      : { categoryId: filters.categoryId, category: { ledgerId } }),
    ...(filters.categoryRootId === undefined
      ? {}
      : {
          OR: [
            {
              categoryId: filters.categoryRootId,
              category: { ledgerId, parentId: null },
            },
            {
              category: {
                ledgerId,
                parentId: filters.categoryRootId,
                parent: { ledgerId, parentId: null },
              },
            },
          ],
        }),
    ...(filters.accountId === undefined
      ? {}
      : { accountId: filters.accountId }),
    ...(filters.payerId === undefined ? {} : { payerId: filters.payerId }),
    ...(occurredAt === undefined ? {} : { occurredAt }),
    AND: and,
  };
}

export function buildStatisticsDayCountQuery(
  userId: string,
  ledgerId: string,
  query: StatisticsQuery,
  occurredAt: StatisticsOccurredAtFilter | undefined,
  timezone: string,
): Prisma.Sql {
  const filters = normalizeFilters(query);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`t."ledger_id" = ${ledgerId}`,
    Prisma.sql`t."deleted_at" IS NULL`,
    Prisma.sql`t."type" IN ('EXPENSE', 'INCOME')`,
    Prisma.sql`(
      t."account_id" IS NULL OR (
        a."ledger_id" = ${ledgerId} AND (
          a."visibility" = 'SHARED' OR
          (a."visibility" = 'PRIVATE' AND a."owner_id" = ${userId})
        )
      )
    )`,
  ];

  if (filters.type !== undefined) {
    conditions.push(Prisma.sql`t."type" = ${filters.type}::"TransactionType"`);
  }
  if (filters.categoryId !== undefined) {
    conditions.push(
      Prisma.sql`c."id" = ${filters.categoryId} AND c."ledger_id" = ${ledgerId}`,
    );
  }
  if (filters.categoryRootId !== undefined) {
    conditions.push(Prisma.sql`(
      (t."category_id" = ${filters.categoryRootId} AND c."ledger_id" = ${ledgerId} AND c."parent_id" IS NULL) OR
      (c."parent_id" = ${filters.categoryRootId} AND c."ledger_id" = ${ledgerId} AND p."ledger_id" = ${ledgerId} AND p."parent_id" IS NULL)
    )`);
  }
  if (filters.accountId !== undefined) {
    conditions.push(Prisma.sql`t."account_id" = ${filters.accountId}`);
  }
  if (filters.payerId !== undefined) {
    conditions.push(Prisma.sql`t."payer_id" = ${filters.payerId} AND EXISTS (
      SELECT 1 FROM "ledger_member" AS l
      WHERE l."ledger_id" = ${ledgerId}
        AND l."user_id" = ${filters.payerId}
        AND l."status" = 'ACTIVE'
    )`);
  }
  if (filters.keyword !== undefined) {
    conditions.push(Prisma.sql`(
      POSITION(LOWER(${filters.keyword}) IN LOWER(COALESCE(t."title", ''))) > 0 OR
      POSITION(LOWER(${filters.keyword}) IN LOWER(COALESCE(t."note", ''))) > 0
    )`);
  }
  if (occurredAt?.gte !== undefined) {
    conditions.push(Prisma.sql`t."occurred_at" >= ${occurredAt.gte}`);
  }
  if (occurredAt?.lt !== undefined) {
    conditions.push(Prisma.sql`t."occurred_at" < ${occurredAt.lt}`);
  }

  return Prisma.sql`
    SELECT COUNT(DISTINCT (t."occurred_at" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date)::int AS "count"
    FROM "transaction" AS t
    LEFT JOIN "account" AS a ON a."id" = t."account_id"
    LEFT JOIN "category" AS c ON c."id" = t."category_id"
    LEFT JOIN "category" AS p ON p."id" = c."parent_id"
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
}
