import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  AcceptedInvitationResult,
  CreateInvitationInput,
  InvitationDetail,
  InvitationPreview,
  InvitationSummary,
} from './invitation-types';

/**
 * 邀请 Token 只在创建响应中出现一次；列表查询不返回 Token。
 * 登录后的链接流程通过 token 详情恢复上下文，再按邀请 ID 响应。
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

/** 撤销待处理邀请；已接受/已拒绝/已过期的邀请会返回 40931。 */
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

/** 登录前预览：公开端点，只用于展示邀请说明。 */
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<InvitationPreview>>('/invitations/preview', {
      params: { token },
    }),
  );
}

/** 登录后按 Token 恢复邀请上下文，返回邮箱匹配状态和可执行动作。 */
export async function getInvitationByToken(token: string): Promise<InvitationDetail> {
  return unwrap(
    await userClient.get<ApiSuccessResponse<InvitationDetail>>('/invitations/token', {
      params: { token },
    }),
  );
}

/** 按邀请记录接受；“我的邀请”和登录回跳流程都不再依赖 Token。 */
export async function acceptInvitationById(invitationId: string): Promise<AcceptedInvitationResult> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<AcceptedInvitationResult>>(
      `/invitations/${encodeURIComponent(invitationId)}/accept`,
    ),
  );
}

/** 按邀请记录拒绝。 */
export async function declineInvitationById(invitationId: string): Promise<null> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<null>>(
      `/invitations/${encodeURIComponent(invitationId)}/decline`,
    ),
  );
}

/** 兼容旧链接：按 Token 接受。新页面优先使用按 ID 响应。 */
export async function acceptInvitation(token: string): Promise<AcceptedInvitationResult> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<AcceptedInvitationResult>>('/invitations/accept', {
      token,
    }),
  );
}

/** 兼容旧链接：按 Token 拒绝。 */
export async function declineInvitation(token: string): Promise<null> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<null>>('/invitations/decline', { token }),
  );
}
