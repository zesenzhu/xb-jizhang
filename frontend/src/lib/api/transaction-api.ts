import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  CreateTransactionInput,
  TransactionListApiResponse,
  TransactionListQuery,
  TransactionListResponse,
  TransactionSummary,
  UpdateTransactionInput,
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

/** 详情不缓存（staleTime 0）：编辑后必须立刻看到新值，他人也可能随时修改。 */
export async function getTransaction(
  ledgerId: string,
  transactionId: string,
): Promise<TransactionSummary> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<TransactionSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions/${encodeURIComponent(transactionId)}`,
    ),
  );
}

export async function createTransaction(
  ledgerId: string,
  input: CreateTransactionInput,
): Promise<TransactionSummary> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<TransactionSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions`,
      input,
    ),
  );
}

export async function updateTransaction(
  ledgerId: string,
  transactionId: string,
  input: UpdateTransactionInput,
): Promise<TransactionSummary> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<TransactionSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions/${encodeURIComponent(transactionId)}`,
      input,
    ),
  );
}

export async function deleteTransaction(
  ledgerId: string,
  transactionId: string,
  version: number,
): Promise<TransactionSummary> {
  return unwrap(
    await userClient.delete<ApiSuccessResponse<TransactionSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions/${encodeURIComponent(transactionId)}`,
      { data: { version } },
    ),
  );
}
