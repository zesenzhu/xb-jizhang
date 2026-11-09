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
  uncategorized?: boolean;
  accountId?: string;
  payerId?: string;
  createdById?: string;
  keyword?: string;
  metric?: StatisticsTrendMetric;
  categoryLevel?: 'ROOT' | 'CHILD';
  sortBy?: 'AMOUNT' | 'PERCENTAGE';
  sortOrder?: 'ASC' | 'DESC';
  includeComparison?: boolean;
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

export interface StatisticsCategoryItem {
  categoryId: string | null;
  categoryRootId: string | null;
  parentId: string | null;
  bucketType: 'CATEGORY' | 'ROOT_DIRECT' | 'UNCATEGORIZED';
  name: string;
  icon: string | null;
  color: string | null;
  amountCents: number;
  percentage: number;
  transactionCount: number;
  comparison: {
    amountCents: number;
    amountDeltaCents: number;
    percentagePointDelta: number | null;
  } | null;
  drilldown: {
    categoryId?: string | null;
    categoryRootId?: string;
    uncategorized?: boolean;
    from: string;
    to: string;
    type: 'EXPENSE' | 'INCOME';
  };
}

export interface StatisticsCategories {
  ledgerId: string;
  type: 'EXPENSE' | 'INCOME';
  totalCents: number;
  range: StatisticsDateRange;
  comparisonRange: { fromDate: string; toDate: string } | null;
  items: StatisticsCategoryItem[];
}
