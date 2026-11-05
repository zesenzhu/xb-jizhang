import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  AcceptedInvitationResult,
  CreateInvitationInput,
  InvitationSummary,
} from './invitation-types';

/**
 * 邀请 Token 只在创建响应中出现一次；列表接口只返回可撤销的业务摘要。
 * 「我的邀请」页仍需要用户从完整链接带 Token 进入接受或拒绝流程。
 */
function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

/** 创建邀请；响应里的 `inviteToken` 用于拼一次性邀请链接，之后不可再取。 */
export async function createInvitation(
  ledgerId: string,
  input: CreateInvitationInput,
): Promise<InvitationSummary> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<InvitationSummary>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/invitations`,
      input,
    ),
  );
}

/** 撤销待处理邀请；已接受/已拒绝/已过期的邀请会返回 40902。 */
export async function revokeInvitation(
  ledgerId: string,
  invitationId: string,
): Promise<null> {
  return unwrap(
    await userClient.delete<ApiSuccessResponse<null>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/invitations/${encodeURIComponent(invitationId)}`,
    ),
  );
}

/** 当前账本 Owner 的待处理邀请；服务端会在读取时把已过期记录标记为 EXPIRED。 */
export async function getLedgerInvitations(ledgerId: string): Promise<InvitationSummary[]> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<InvitationSummary[]>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/invitations`,
    ),
  );
}

/** 当前用户可处理的邀请（按过期时间升序）；不返回 Token。 */
export async function getMyInvitations(): Promise<InvitationSummary[]> {
  return unwrap(await userClient.get<ApiSuccessResponse<InvitationSummary[]>>('/invitations'));
}

/** 接受邀请：服务端校验 Token、过期时间与目标邮箱，成功后可访问该账本。 */
export async function acceptInvitation(token: string): Promise<AcceptedInvitationResult> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<AcceptedInvitationResult>>('/invitations/accept', {
      token,
    }),
  );
}

/** 拒绝邀请；重复拒绝同一邀请是幂等的。 */
export async function declineInvitation(token: string): Promise<null> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<null>>('/invitations/decline', { token }),
  );
}
