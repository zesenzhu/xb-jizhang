import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  StatisticsOverview,
  StatisticsOverviewQuery,
  TransactionListApiResponse,
  TransactionListQuery,
  TransactionListResponse,
} from './transaction-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

/** 去掉值为 undefined 的查询参数，避免 `?type=undefined` 被服务端当成筛选条件。 */
function toParams(query: object): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value as string | number;
    }
  }
  return params;
}

export async function getTransactions(
  ledgerId: string,
  query: TransactionListQuery = {},
): Promise<TransactionListResponse> {
  return unwrap(
    await userClient.get<TransactionListApiResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions`,
      { params: toParams(query) },
    ),
  );
}

export async function getStatisticsOverview(
  ledgerId: string,
  query: StatisticsOverviewQuery = {},
): Promise<StatisticsOverview> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<StatisticsOverview>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/statistics/overview`,
      { params: toParams(query) },
    ),
  );
}
