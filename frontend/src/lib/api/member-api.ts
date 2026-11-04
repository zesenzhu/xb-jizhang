import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type { LedgerMemberListApiResponse, LedgerMemberListResponse } from './member-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function getLedgerMembers(
  ledgerId: string,
  pageSize = 100,
): Promise<LedgerMemberListResponse> {
  return unwrap(
    await userClient.get<LedgerMemberListApiResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/members`,
      { params: { page: 1, pageSize } },
    ),
  );
}
