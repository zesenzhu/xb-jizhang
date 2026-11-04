import type { TransactionType } from '@prisma/client';

export type StatisticsPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'RANGE';

export type StatisticsGranularity = 'AUTO' | 'DAY' | 'MONTH' | 'YEAR';

export type ResolvedStatisticsGranularity = Exclude<
  StatisticsGranularity,
  'AUTO'
>;

export interface StatisticsDateRangeQuery {
  period?: StatisticsPeriod;
  anchorDate?: string;
  fromDate?: string;
  toDate?: string;
  granularity?: StatisticsGranularity;
}

export interface StatisticsDateRange {
  period: StatisticsPeriod;
  timezone: string;
  fromDate: string | null;
  toDate: string | null;
  startAt: string | null;
  endAt: string | null;
  granularity: ResolvedStatisticsGranularity;
}

export interface StatisticsQuery extends StatisticsDateRangeQuery {
  from?: string;
  to?: string;
  type?: Extract<TransactionType, 'EXPENSE' | 'INCOME'>;
  categoryId?: string;
  accountId?: string;
  payerId?: string;
  keyword?: string;
}

export interface StatisticsOverview {
  from: string | null;
  to: string | null;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  transactionCount: number;
}
