import type { TransactionType } from '@prisma/client';

export type StatisticsPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'RANGE';

export type StatisticsGranularity = 'AUTO' | 'DAY' | 'MONTH' | 'YEAR';

export type StatisticsTrendMetric = 'EXPENSE' | 'INCOME' | 'NET';

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

export interface StatisticsQuery extends StatisticsDateRangeQuery {
  from?: string;
  to?: string;
  type?: Extract<TransactionType, 'EXPENSE' | 'INCOME'>;
  categoryId?: string;
  categoryRootId?: string;
  accountId?: string;
  payerId?: string;
  keyword?: string;
  metric?: StatisticsTrendMetric;
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

export interface LegacyStatisticsOverview {
  from: string | null;
  to: string | null;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  transactionCount: number;
}

export interface PeriodStatisticsOverview {
  ledgerId: string;
  range: StatisticsDateRange;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  averageDailyExpenseCents: number;
  effectiveDayCount: number;
  transactionCount: number;
}

export type StatisticsOverview =
  LegacyStatisticsOverview | PeriodStatisticsOverview;

export interface StatisticsAggregate {
  periodStart: string;
  expenseCents: number | bigint | string;
  incomeCents: number | bigint | string;
  transactionCount: number | bigint | string;
}

export interface StatisticsTrendItem {
  fromDate: string;
  toDate: string;
  valueCents: number;
  expenseCents: number;
  incomeCents: number;
  netCents: number;
  transactionCount: number;
  drilldown: { from: string; to: string };
}

export interface StatisticsTrend {
  ledgerId: string;
  range: StatisticsDateRange;
  hasData: boolean;
  items: StatisticsTrendItem[];
}

export interface StatisticsPeriodsSummary {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  averageDailyExpenseCents: number;
  effectiveDayCount: number;
  transactionCount: number;
}

export interface StatisticsPeriodsItem {
  fromDate: string;
  toDate: string;
  expenseCents: number;
  incomeCents: number;
  netCents: number;
  transactionCount: number;
  drilldown: { from: string; to: string };
}

export interface StatisticsPeriods {
  ledgerId: string;
  range: StatisticsDateRange;
  summary: StatisticsPeriodsSummary;
  items: StatisticsPeriodsItem[];
}
