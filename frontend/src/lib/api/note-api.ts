import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type { NoteSuggestionsResponse } from './transaction-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

/** 当前用户在当前账本中最近使用的备注；服务端负责账本隔离、去重和 200 字过滤。 */
export async function getNoteSuggestions(
  ledgerId: string,
  limit = 10,
): Promise<NoteSuggestionsResponse> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<NoteSuggestionsResponse>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/note-suggestions`,
      { params: { limit } },
    ),
  );
}
