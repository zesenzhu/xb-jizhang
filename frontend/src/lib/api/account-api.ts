import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type { AccountListApiResponse, AccountListQuery, AccountListResponse } from './account-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function getAccounts(
  ledgerId: string,
  query: AccountListQuery = {},
): Promise<AccountListResponse> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value as string | number | boolean;
    }
  }

  return unwrap(
    await userClient.get<AccountListApiResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/accounts`,
      { params },
    ),
  );
}
