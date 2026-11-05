import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  CopyLedgerInput,
  CreateLedgerInput,
  LedgerListApiResponse,
  LedgerListQuery,
  LedgerListResponse,
  LedgerPreferences,
  LedgerSummary,
  UpdateLedgerInput,
  UpdateLedgerPreferencesInput,
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

/**
 * 当前/默认账本偏好。
 *
 * 切换当前账本**必须**走这个接口：只改本地 store 会让多设备不同步，
 * 也会让「我的账本」的 `isCurrent` 与服务端不一致。
 */
export async function getLedgerPreferences(): Promise<LedgerPreferences> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<LedgerPreferences>>('/me/ledger-preferences'),
  );
}

export async function updateLedgerPreferences(
  input: UpdateLedgerPreferencesInput,
): Promise<LedgerPreferences> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<LedgerPreferences>>('/me/ledger-preferences', input),
  );
}

/** 复制账本：服务端只复制基本设置与分类树，不复制账单、成员与账户。 */
export async function copyLedger(
  ledgerId: string,
  input: CopyLedgerInput,
): Promise<LedgerSummary> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<LedgerSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/copy`,
      input,
    ),
  );
}

/**
 * 永久删除账本。只有「无账单、无其他活跃成员、无待处理邀请、不是最后一本」才成功；
 * 条件不满足由服务端返回 40911–40914，前端负责把码翻成人话。
 */
export async function deleteLedger(ledgerId: string): Promise<null> {
  return unwrap(
    await userClient.delete<ApiSuccessResponse<null>>(`/ledgers/${encodeURIComponent(ledgerId)}`),
  );
}
