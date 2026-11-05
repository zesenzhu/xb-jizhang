import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import type { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStatisticsDateRange } from './statistics-date-range';
import {
  buildStatisticsPeriodSlots,
  statisticsPeriodKey,
} from './statistics-periods';
import {
  buildStatisticsDayCountQuery,
  buildStatisticsPeriodAggregateQuery,
  buildStatisticsWhere,
} from './statistics-query';
import type {
  PeriodStatisticsOverview,
  StatisticsAggregate,
  StatisticsCategories,
  StatisticsCategoryItem,
  StatisticsDateRange,
  StatisticsOverview,
  StatisticsPeriods,
  StatisticsQuery,
  StatisticsTrend,
} from './statistics.types';

type CategoryMetadata = Pick<
  Category,
  'id' | 'parentId' | 'name' | 'icon' | 'color'
>;
interface CategoryAggregate {
  categoryId: string | null;
  _sum: { amountCents: number | null };
  _count: { id: number };
}
interface CategoryBucket {
  category: CategoryMetadata | null;
  amountCents: number;
  transactionCount: number;
}

function percentage(amount: number, total: number): number {
  return total === 0 ? 0 : Math.round((amount / total) * 10000) / 100;
}

function toSafeInteger(value: number | bigint | string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error('统计聚合结果超出安全整数范围');
  }
  return result;
}

function aggregateCents(
  rows: StatisticsAggregate[],
  field: 'expenseCents' | 'incomeCents' | 'transactionCount',
): number {
  return rows.reduce((total, row) => total + toSafeInteger(row[field]), 0);
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
  ): Promise<StatisticsCategories> {
    const { timezone } = await this.getActiveLedgerContext(userId, ledgerId);
    this.validateCategoryQuery(query);
    const type = query.type ?? 'EXPENSE';
    if (query.categoryRootId !== undefined) {
      const root = await this.prisma.category.findFirst({
        where: {
          id: query.categoryRootId,
          ledgerId,
          type,
          parentId: null,
        },
        select: { id: true },
      });
      if (!root) throw this.notFoundException();
    }
    const range = await this.resolveDateRange(
      userId,
      ledgerId,
      query,
      timezone,
    );
    if (range.startAt === null || range.endAt === null) {
      return {
        ledgerId,
        type,
        totalCents: 0,
        range,
        comparisonRange: null,
        items: [],
      };
    }
    const comparisonRange = query.includeComparison
      ? this.categoryComparisonRange(range)
      : null;
    const aggregate = (startAt: string, endAt: string) =>
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: buildStatisticsWhere(
          userId,
          ledgerId,
          { ...query, type },
          {
            gte: new Date(startAt),
            lt: new Date(endAt),
          },
        ),
        _sum: { amountCents: true },
        _count: { id: true },
      });
    const [metadata, currentRows, previousRows] = await Promise.all([
      this.prisma.category.findMany({
        // Inactive categories remain part of historical statistics.
        where: { ledgerId, type },
        select: {
          id: true,
          parentId: true,
          name: true,
          icon: true,
          color: true,
        },
      }),
      aggregate(range.startAt, range.endAt),
      comparisonRange
        ? aggregate(comparisonRange.startAt, comparisonRange.endAt)
        : Promise.resolve([]),
    ]);
    const byId = new Map(metadata.map((category) => [category.id, category]));
    const current = this.categoryBuckets(currentRows, byId, query);
    const previous = this.categoryBuckets(previousRows, byId, query);
    const totalCents = toSafeInteger(
      [...current.values()].reduce(
        (sum, bucket) => sum + bucket.amountCents,
        0,
      ),
    );
    const previousTotal = toSafeInteger(
      [...previous.values()].reduce(
        (sum, bucket) => sum + bucket.amountCents,
        0,
      ),
    );
    const items: StatisticsCategoryItem[] = [];
    for (const id of new Set([...current.keys(), ...previous.keys()])) {
      const now = current.get(id);
      const before = previous.get(id);
      const amountCents = now?.amountCents ?? 0;
      const previousAmount = before?.amountCents ?? 0;
      if (amountCents === 0 && previousAmount === 0) continue;
      const category = (now ?? before)!.category;
      const direct =
        query.categoryLevel === 'CHILD' &&
        category?.id === query.categoryRootId;
      const rootView = query.categoryLevel !== 'CHILD';
      const currentPercentage = percentage(amountCents, totalCents);
      items.push({
        categoryId: id,
        categoryRootId: category ? (category.parentId ?? category.id) : null,
        parentId: category?.parentId ?? null,
        bucketType:
          category === null
            ? 'UNCATEGORIZED'
            : direct
              ? 'ROOT_DIRECT'
              : 'CATEGORY',
        name:
          category === null
            ? '未分类'
            : direct
              ? `${category.name}（未细分）`
              : category.name,
        icon: category?.icon ?? null,
        color: category?.color ?? null,
        amountCents,
        percentage: currentPercentage,
        transactionCount: now?.transactionCount ?? 0,
        comparison: comparisonRange
          ? {
              amountCents: previousAmount,
              amountDeltaCents: amountCents - previousAmount,
              percentagePointDelta:
                previousTotal === 0
                  ? null
                  : Math.round(
                      (currentPercentage -
                        percentage(previousAmount, previousTotal)) *
                        100,
                    ) / 100,
            }
          : null,
        drilldown: {
          ...(category === null
            ? { uncategorized: true }
            : rootView
              ? { categoryRootId: category.id }
              : { categoryId: id }),
          from: range.startAt,
          to: range.endAt,
          type,
        },
      });
    }
    const field = query.sortBy === 'PERCENTAGE' ? 'percentage' : 'amountCents';
    const direction = query.sortOrder === 'ASC' ? 1 : -1;
    items.sort(
      (a, b) =>
        direction * (a[field] - b[field]) ||
        a.name.localeCompare(b.name) ||
        (a.categoryId ?? '').localeCompare(b.categoryId ?? ''),
    );
    return {
      ledgerId,
      type,
      totalCents,
      range,
      comparisonRange: comparisonRange
        ? {
            fromDate: comparisonRange.fromDate,
            toDate: comparisonRange.toDate,
          }
        : null,
      items,
    };
  }

  private validateCategoryQuery(query: StatisticsQuery): void {
    if (
      (query.categoryLevel === 'CHILD' && query.categoryRootId === undefined) ||
      (query.categoryId !== undefined && query.categoryRootId !== undefined)
    ) {
      throw new BadRequestException({
        code: 40023,
        message: '分类参数冲突或缺少一级分类',
        data: null,
      });
    }
    if (
      query.categoryId !== undefined ||
      query.from !== undefined ||
      query.to !== undefined ||
      (query.type !== undefined &&
        !['EXPENSE', 'INCOME'].includes(query.type)) ||
      (query.categoryLevel !== undefined &&
        !['ROOT', 'CHILD'].includes(query.categoryLevel)) ||
      (query.sortBy !== undefined &&
        !['AMOUNT', 'PERCENTAGE'].includes(query.sortBy)) ||
      (query.sortOrder !== undefined &&
        !['ASC', 'DESC'].includes(query.sortOrder)) ||
      (query.includeComparison !== undefined &&
        typeof query.includeComparison !== 'boolean') ||
      (query.period === 'ALL' && query.includeComparison)
    )
      throw this.invalidInputException();
  }

  private categoryComparisonRange(range: StatisticsDateRange): {
    fromDate: string;
    toDate: string;
    startAt: string;
    endAt: string;
  } {
    const end = Temporal.PlainDate.from(range.fromDate!);
    const start =
      range.period === 'MONTH'
        ? end.subtract({ months: 1 })
        : range.period === 'YEAR'
          ? end.subtract({ years: 1 })
          : end.subtract({
              days:
                range.period === 'WEEK'
                  ? 7
                  : end.until(Temporal.PlainDate.from(range.toDate!), {
                      largestUnit: 'day',
                    }).days + 1,
            });
    return {
      fromDate: start.toString(),
      toDate: end.subtract({ days: 1 }).toString(),
      startAt: start
        .toZonedDateTime({ timeZone: range.timezone, plainTime: '00:00' })
        .toInstant()
        .toString({ fractionalSecondDigits: 3 }),
      endAt: range.startAt!,
    };
  }

  private categoryBuckets(
    rows: CategoryAggregate[],
    metadata: Map<string, CategoryMetadata>,
    query: StatisticsQuery,
  ): Map<string | null, CategoryBucket> {
    const buckets = new Map<string | null, CategoryBucket>();
    for (const row of rows) {
      let category =
        row.categoryId === null ? null : metadata.get(row.categoryId);
      if (category === undefined) continue;
      if (query.categoryLevel !== 'CHILD' && category?.parentId)
        category = metadata.get(category.parentId);
      if (category === undefined) continue;
      const id = category?.id ?? null;
      const bucket = buckets.get(id) ?? {
        category,
        amountCents: 0,
        transactionCount: 0,
      };
      bucket.amountCents = toSafeInteger(
        bucket.amountCents + (row._sum.amountCents ?? 0),
      );
      bucket.transactionCount += row._count.id;
      buckets.set(id, bucket);
    }
    return buckets;
  }

  async overview(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
  ): Promise<StatisticsOverview> {
    const { timezone } = await this.getActiveLedgerContext(userId, ledgerId);

    if (query.period !== undefined) {
      return this.periodOverview(userId, ledgerId, query, timezone);
    }

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: buildStatisticsWhere(
        userId,
        ledgerId,
        query,
        this.buildDateRange(query.from, query.to),
      ),
      _sum: { amountCents: true },
      _count: { id: true },
    });
    const totalIncomeCents = this.sumByType(grouped, 'INCOME');
    const totalExpenseCents = this.sumByType(grouped, 'EXPENSE');
    const transactionCount = grouped.reduce(
      (total, item) => total + item._count.id,
      0,
    );
    return {
      from: query.from ?? null,
      to: query.to ?? null,
      totalIncomeCents,
      totalExpenseCents,
      netCents: totalIncomeCents - totalExpenseCents,
      transactionCount,
    };
  }

  private async getActiveLedgerContext(
    userId: string,
    ledgerId: string,
  ): Promise<{ timezone: string }> {
    const member = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      select: { status: true, ledger: { select: { timezone: true } } },
    });
    if (!member || member.status !== 'ACTIVE') throw this.notFoundException();
    return { timezone: member.ledger.timezone };
  }

  private async resolveDateRange(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
    timezone: string,
  ): Promise<StatisticsDateRange> {
    let allStartDate: string | undefined;
    if (query.period === 'ALL') {
      const firstVisibleTransaction = await this.prisma.transaction.findFirst({
        where: buildStatisticsWhere(userId, ledgerId, {}),
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      });
      if (firstVisibleTransaction) {
        allStartDate = Temporal.Instant.from(
          firstVisibleTransaction.occurredAt.toISOString(),
        )
          .toZonedDateTimeISO(timezone)
          .toPlainDate()
          .toString();
      }
    }
    return resolveStatisticsDateRange(query, timezone, { allStartDate });
  }

  private async periodOverview(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
    timezone: string,
  ): Promise<PeriodStatisticsOverview> {
    const range = await this.resolveDateRange(
      userId,
      ledgerId,
      query,
      timezone,
    );
    if (range.startAt === null || range.endAt === null) {
      return this.emptyPeriodOverview(ledgerId, range);
    }

    const occurredAt = {
      gte: new Date(range.startAt),
      lt: new Date(range.endAt),
    };
    const where = buildStatisticsWhere(userId, ledgerId, query, occurredAt);
    const [grouped, effectiveDayRows] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { amountCents: true },
        _count: { id: true },
      }),
      this.prisma.$queryRaw<Array<{ count: number }>>(
        buildStatisticsDayCountQuery(
          userId,
          ledgerId,
          query,
          occurredAt,
          timezone,
        ),
      ),
    ]);

    const totalIncomeCents = this.sumByType(grouped, 'INCOME');
    const totalExpenseCents = this.sumByType(grouped, 'EXPENSE');
    const effectiveDayCount = effectiveDayRows[0]?.count ?? 0;
    return {
      ledgerId,
      range,
      totalIncomeCents,
      totalExpenseCents,
      netCents: totalIncomeCents - totalExpenseCents,
      averageDailyExpenseCents:
        effectiveDayCount === 0
          ? 0
          : Math.round(totalExpenseCents / effectiveDayCount),
      effectiveDayCount,
      transactionCount: grouped.reduce(
        (total, item) => total + item._count.id,
        0,
      ),
    };
  }

  async trend(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
  ): Promise<StatisticsTrend> {
    const { timezone } = await this.getActiveLedgerContext(userId, ledgerId);
    const range = await this.resolveDateRange(
      userId,
      ledgerId,
      query,
      timezone,
    );
    if (range.startAt === null || range.endAt === null) {
      return { ledgerId, range, hasData: false, items: [] };
    }

    const occurredAt = {
      gte: new Date(range.startAt),
      lt: new Date(range.endAt),
    };
    const rows = await this.prisma.$queryRaw<StatisticsAggregate[]>(
      buildStatisticsPeriodAggregateQuery(
        userId,
        ledgerId,
        query,
        occurredAt,
        timezone,
        range.granularity,
      ),
    );
    if (rows.length === 0) {
      return { ledgerId, range, hasData: false, items: [] };
    }

    const rowsByPeriod = new Map(
      rows.map((row) => [row.periodStart, row] as const),
    );
    const metric = query.metric ?? 'EXPENSE';
    const items = buildStatisticsPeriodSlots(range).map((slot) => {
      const key = statisticsPeriodKey(slot.fromDate, range.granularity);
      const row = rowsByPeriod.get(key);
      const expenseCents = toSafeInteger(row?.expenseCents ?? 0);
      const incomeCents = toSafeInteger(row?.incomeCents ?? 0);
      const netCents = incomeCents - expenseCents;
      return {
        ...slot,
        valueCents:
          metric === 'INCOME'
            ? incomeCents
            : metric === 'NET'
              ? netCents
              : expenseCents,
        expenseCents,
        incomeCents,
        netCents,
        transactionCount: toSafeInteger(row?.transactionCount ?? 0),
      };
    });
    return { ledgerId, range, hasData: true, items };
  }

  async periods(
    userId: string,
    ledgerId: string,
    query: StatisticsQuery,
  ): Promise<StatisticsPeriods> {
    const { timezone } = await this.getActiveLedgerContext(userId, ledgerId);
    const range = await this.resolveDateRange(
      userId,
      ledgerId,
      query,
      timezone,
    );
    if (range.startAt === null || range.endAt === null) {
      return {
        ledgerId,
        range,
        summary: {
          totalIncomeCents: 0,
          totalExpenseCents: 0,
          netCents: 0,
          averageDailyExpenseCents: 0,
          effectiveDayCount: 0,
          transactionCount: 0,
        },
        items: [],
      };
    }

    const occurredAt = {
      gte: new Date(range.startAt),
      lt: new Date(range.endAt),
    };
    const [rows, effectiveDayRows] = await Promise.all([
      this.prisma.$queryRaw<StatisticsAggregate[]>(
        buildStatisticsPeriodAggregateQuery(
          userId,
          ledgerId,
          query,
          occurredAt,
          timezone,
          range.granularity,
        ),
      ),
      this.prisma.$queryRaw<Array<{ count: number }>>(
        buildStatisticsDayCountQuery(
          userId,
          ledgerId,
          query,
          occurredAt,
          timezone,
        ),
      ),
    ]);
    const totalExpenseCents = aggregateCents(rows, 'expenseCents');
    const totalIncomeCents = aggregateCents(rows, 'incomeCents');
    const effectiveDayCount = effectiveDayRows[0]?.count ?? 0;
    const rowsByPeriod = new Map(
      rows.map((row) => [row.periodStart, row] as const),
    );
    const items = buildStatisticsPeriodSlots(range).map((slot) => {
      const row = rowsByPeriod.get(
        statisticsPeriodKey(slot.fromDate, range.granularity),
      );
      const expenseCents = toSafeInteger(row?.expenseCents ?? 0);
      const incomeCents = toSafeInteger(row?.incomeCents ?? 0);
      return {
        ...slot,
        expenseCents,
        incomeCents,
        netCents: incomeCents - expenseCents,
        transactionCount: toSafeInteger(row?.transactionCount ?? 0),
      };
    });

    return {
      ledgerId,
      range,
      summary: {
        totalIncomeCents,
        totalExpenseCents,
        netCents: totalIncomeCents - totalExpenseCents,
        averageDailyExpenseCents:
          effectiveDayCount === 0
            ? 0
            : Math.round(totalExpenseCents / effectiveDayCount),
        effectiveDayCount,
        transactionCount: aggregateCents(rows, 'transactionCount'),
      },
      items,
    };
  }

  private emptyPeriodOverview(
    ledgerId: string,
    range: PeriodStatisticsOverview['range'],
  ): PeriodStatisticsOverview {
    return {
      ledgerId,
      range,
      totalIncomeCents: 0,
      totalExpenseCents: 0,
      netCents: 0,
      averageDailyExpenseCents: 0,
      effectiveDayCount: 0,
      transactionCount: 0,
    };
  }

  private sumByType(
    grouped: Array<{
      type: string;
      _sum: { amountCents: number | null };
      _count: { id: number };
    }>,
    type: 'EXPENSE' | 'INCOME',
  ): number {
    return grouped.find((item) => item.type === type)?._sum.amountCents ?? 0;
  }

  private buildDateRange(
    from?: string,
    to?: string,
  ): { gte?: Date; lt?: Date } | undefined {
    if (from === undefined && to === undefined) return undefined;
    const fromDate = from === undefined ? undefined : new Date(from);
    const toDate = to === undefined ? undefined : new Date(to);
    if (fromDate && Number.isNaN(fromDate.getTime()))
      throw this.invalidInputException();
    if (toDate && Number.isNaN(toDate.getTime()))
      throw this.invalidInputException();
    if (fromDate && toDate && fromDate >= toDate)
      throw this.invalidInputException();
    return {
      ...(fromDate === undefined ? {} : { gte: fromDate }),
      ...(toDate === undefined ? {} : { lt: toDate }),
    };
  }

  private invalidInputException(): BadRequestException {
    return new BadRequestException({
      code: 40021,
      message: '统计参数不合法',
      data: null,
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({
      code: 40421,
      message: '账本资源不存在',
      data: null,
    });
  }
}
