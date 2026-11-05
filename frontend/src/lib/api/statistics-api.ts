import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  CategoryApiResponse,
  CategoryData,
  CategoryQuery,
  FilteredStatisticsQuery,
  OverviewApiResponse,
  OverviewData,
  OverviewResponse,
  PeriodApiResponse,
  PeriodData,
  StatisticsQuery,
  TrendApiResponse,
  TrendData,
  TrendQuery,
} from './statistics-types';
import { isPeriodOverview } from './statistics-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

/** 剔除空值：服务端把空字符串当作「未传」，但显式传空会干扰缓存键与日志。 */
function toParams(query: object): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value as string | number | boolean;
    }
  }
  return params;
}

function basePath(ledgerId: string, section: string): string {
  return `/ledgers/${encodeURIComponent(ledgerId)}/statistics/${section}`;
}

export async function getStatisticsOverview(
  ledgerId: string,
  query: StatisticsQuery,
): Promise<OverviewData> {
  const data: OverviewResponse = unwrap(
    await userClient.get<OverviewApiResponse>(basePath(ledgerId, 'overview'), {
      params: toParams(query),
    }),
  );
  // 不传 period 时后端会退回一期结构；调用方必须带 period，这里直接报错而不是静默降级。
  if (!isPeriodOverview(data)) {
    throw new Error('overview 返回了一期兼容结构，请检查 period 参数是否传全');
  }
  return data;
}

export async function getStatisticsTrend(
  ledgerId: string,
  query: TrendQuery,
): Promise<TrendData> {
  return unwrap(
    await userClient.get<TrendApiResponse>(basePath(ledgerId, 'trend'), {
      params: toParams(query),
    }),
  );
}

export async function getStatisticsCategories(
  ledgerId: string,
  query: CategoryQuery,
): Promise<CategoryData> {
  return unwrap(
    await userClient.get<CategoryApiResponse>(basePath(ledgerId, 'categories'), {
      params: toParams(query),
    }),
  );
}

export async function getStatisticsPeriods(
  ledgerId: string,
  query: FilteredStatisticsQuery,
): Promise<PeriodData> {
  return unwrap(
    await userClient.get<PeriodApiResponse>(basePath(ledgerId, 'periods'), {
      params: toParams(query),
    }),
  );
}
