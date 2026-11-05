import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  LedgerMemberListApiResponse,
  LedgerMemberListResponse,
  LedgerMemberSummary,
  OwnershipTransferResult,
} from './member-types';

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

/**
 * 角色变更。
 *
 * 不能让账本没有 Owner：把最后一个 Owner 降级会被服务端拒绝（40902），
 * 前端应在按钮层就禁用并提示走「转移所有权」。
 */
export async function updateMemberRole(
  ledgerId: string,
  memberId: string,
  role: 'OWNER' | 'EDITOR' | 'VIEWER',
): Promise<LedgerMemberSummary> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<LedgerMemberSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/members/${encodeURIComponent(memberId)}/role`,
      { role },
    ),
  );
}

/** 移除成员：服务端只把状态改为 REMOVED，保留关系用于审计与防重复邀请。 */
export async function removeMember(ledgerId: string, memberId: string): Promise<null> {
  return unwrap(
    await userClient.delete<ApiSuccessResponse<null>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/members/${encodeURIComponent(memberId)}`,
    ),
  );
}

/** 主动退出共享账本；最后一名 Owner 不能退出。 */
export async function leaveLedger(ledgerId: string): Promise<null> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<null>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/members/leave`,
    ),
  );
}

/** 转移 Owner：成功后原 Owner 降为 EDITOR，账本始终保留一名 Owner。 */
export async function transferOwnership(
  ledgerId: string,
  targetMemberId: string,
): Promise<OwnershipTransferResult> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<OwnershipTransferResult>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/ownership-transfer`,
      { targetMemberId },
    ),
  );
}
