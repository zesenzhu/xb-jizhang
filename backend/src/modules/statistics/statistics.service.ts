import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
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
  StatisticsDateRange,
  StatisticsOverview,
  StatisticsPeriods,
  StatisticsQuery,
  StatisticsTrend,
} from './statistics.types';

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
