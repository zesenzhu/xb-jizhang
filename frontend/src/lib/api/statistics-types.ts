import type { ApiSuccessResponse } from './auth-types';
import type { CategoryIconSource } from './category-types';

/**
 * 二期统计契约（`docs/api/统计接口.md`）。
 *
 * 后端目前只实现一期口径的 `overview`；下面这组类型按目标契约定，
 * 这样接口就绪时只需替换 api 层实现，页面与图表不用改。
 */

export type StatisticsPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'RANGE';
export type StatisticsGranularity = 'AUTO' | 'DAY' | 'MONTH' | 'YEAR';

/**
 * 四个统计接口共用的时间范围上下文，由服务端计算并回传。
 *
 * `range` 对象本身始终存在，但 `period=ALL` 且没有可见账单时，
 * 四个日期字段为 `null` —— 前端必须按 null 处理，不能假设一定有日期。
 */
export interface StatisticsRange {
  period: StatisticsPeriod;
  timezone: string;
  fromDate: string | null;
  toDate: string | null;
  /** 用于账单下钻的 UTC 半开区间，`endAt` 严格不包含 */
  startAt: string | null;
  endAt: string | null;
  granularity: Exclude<StatisticsGranularity, 'AUTO'>;
}

/** 四个接口的共同请求参数。 */
export interface StatisticsQuery {
  period: StatisticsPeriod;
  /** WEEK/MONTH/YEAR 必填，账本时区下的自然日期 */
  anchorDate?: string;
  /** RANGE 必填，首尾均包含 */
  fromDate?: string;
  toDate?: string;
  granularity?: StatisticsGranularity;
  /** 账单类型过滤；categories 默认 EXPENSE，其余接口不传时统计两类 */
  type?: 'EXPENSE' | 'INCOME';
  accountId?: string;
  payerId?: string;
  createdById?: string;
  keyword?: string;
  /** 只匹配没有分类的账单；与 categoryId/categoryRootId 互斥。 */
  uncategorized?: boolean;
}

/** 一期口径（`from`/`to`），仅在不传 `period` 时返回，二期前端不使用。 */
export interface LegacyOverviewData {
  from: string | null;
  to: string | null;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  transactionCount: number;
}

export interface OverviewData {
  ledgerId: string;
  range: StatisticsRange;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  averageDailyExpenseCents: number;
  /** 存在可见账单的本地自然日数量，不是范围总天数 */
  effectiveDayCount: number;
  transactionCount: number;
}

/** 不传 period 时后端返回一期兼容结构，前端需要能区分并拒绝渲染。 */
export type OverviewResponse = OverviewData | LegacyOverviewData;

export function isPeriodOverview(value: OverviewResponse): value is OverviewData {
  return 'range' in value && 'averageDailyExpenseCents' in value;
}

export type TrendMetric = 'EXPENSE' | 'INCOME' | 'NET';

export interface TrendItem {
  fromDate: string;
  toDate: string;
  /** 由请求的 metric 决定，等于 expenseCents / incomeCents / netCents 之一 */
  valueCents: number;
  expenseCents: number;
  incomeCents: number;
  netCents: number;
  transactionCount: number;
  drilldown: { from: string; to: string };
}

export interface TrendData {
  ledgerId: string;
  range: StatisticsRange;
  /** 应用全部筛选后是否有可见账单；false 时 items 为空，前端不画全零图 */
  hasData: boolean;
  items: TrendItem[];
}

export type CategoryBucketType = 'CATEGORY' | 'ROOT_DIRECT' | 'UNCATEGORIZED';
export type CategoryLevel = 'ROOT' | 'CHILD';
export type CategorySortBy = 'AMOUNT' | 'PERCENTAGE';
export type SortOrder = 'ASC' | 'DESC';

export interface CategoryComparison {
  amountCents: number;
  amountDeltaCents: number;
  /** 上期总额为零时为 null */
  percentagePointDelta: number | null;
}

export interface CategoryItem {
  /** 未分类项为 null */
  categoryId: string | null;
  categoryRootId: string | null;
  parentId: string | null;
  bucketType: CategoryBucketType;
  name: string;
  icon?: string | null;
  color: string | null;
  iconSource?: CategoryIconSource | null;
  iconKey?: string | null;
  iconAssetId?: string | null;
  iconUrl?: string | null;
  iconUrlExpiresAt?: string | null;
  amountCents: number;
  percentage: number;
  transactionCount: number;
  comparison: CategoryComparison | null;
  drilldown: {
    categoryRootId?: string;
    categoryId?: string | null;
    uncategorized?: boolean;
    from: string;
    to: string;
    type: 'EXPENSE' | 'INCOME';
  };
}

/** 统计图表前端聚合的“其他”项，不代表后端真实分类。 */
export type CategoryChartItem = Omit<CategoryItem, 'bucketType' | 'drilldown'> & {
  bucketType: CategoryBucketType | 'OTHER';
  drilldown: CategoryItem['drilldown'] | null;
};

export interface CategoryData {
  ledgerId: string;
  type: 'EXPENSE' | 'INCOME';
  totalCents: number;
  range: StatisticsRange;
  items: CategoryItem[];
  comparisonRange: { fromDate: string; toDate: string } | null;
}

export interface PeriodItem {
  fromDate: string;
  toDate: string;
  expenseCents: number;
  incomeCents: number;
  netCents: number;
  transactionCount: number;
  drilldown: { from: string; to: string };
}

export interface PeriodSummary {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  averageDailyExpenseCents: number;
  effectiveDayCount: number;
  transactionCount: number;
}

export interface PeriodData {
  ledgerId: string;
  range: StatisticsRange;
  summary: PeriodSummary;
  items: PeriodItem[];
}

export type OverviewApiResponse = ApiSuccessResponse<OverviewResponse>;
export type TrendApiResponse = ApiSuccessResponse<TrendData>;
export type CategoryApiResponse = ApiSuccessResponse<CategoryData>;
export type PeriodApiResponse = ApiSuccessResponse<PeriodData>;

/** 趋势接口专属参数 */
export interface TrendQuery extends StatisticsQuery {
  metric?: TrendMetric;
  categoryId?: string;
  categoryRootId?: string;
}

/** 分类接口专属参数 */
export interface CategoryQuery extends StatisticsQuery {
  type?: 'EXPENSE' | 'INCOME';
  categoryLevel?: CategoryLevel;
  categoryRootId?: string;
  sortBy?: CategorySortBy;
  sortOrder?: SortOrder;
  includeComparison?: boolean;
}

/** 概览/周期接口的分类过滤 */
export interface FilteredStatisticsQuery extends StatisticsQuery {
  categoryId?: string;
  categoryRootId?: string;
}
