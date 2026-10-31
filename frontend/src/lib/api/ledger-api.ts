import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  CreateLedgerInput,
  LedgerListApiResponse,
  LedgerListQuery,
  LedgerListResponse,
  LedgerSummary,
  UpdateLedgerInput,
} from './ledger-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function getLedgers(query: LedgerListQuery = {}): Promise<LedgerListResponse> {
  return unwrap(await userClient.get<LedgerListApiResponse>('/ledgers', { params: query }));
}

export async function createLedger(input: CreateLedgerInput): Promise<LedgerSummary> {
  return unwrap(await userClient.post<ApiSuccessResponse<LedgerSummary>>('/ledgers', input));
}

export async function getLedger(ledgerId: string): Promise<LedgerSummary> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<LedgerSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}`,
    ),
  );
}

export async function updateLedger(
  ledgerId: string,
  input: UpdateLedgerInput,
): Promise<LedgerSummary> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<LedgerSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}`,
      input,
    ),
  );
}
