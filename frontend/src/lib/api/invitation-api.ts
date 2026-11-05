import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type {
  AcceptedInvitationResult,
  CreateInvitationInput,
  InvitationSummary,
} from './invitation-types';

/**
 * 邀请相关接口。
 *
 * **缺口（P5）**：服务端只实现 `GET /invitations`（当前用户可处理的邀请），
 * 没有 `GET /ledgers/:ledgerId/invitations`（账本内全部待处理邀请）。
 * 因此「成员与邀请」页无法列出别人发起的待处理邀请，只能展示本次会话内新建、
 * 且仍持有一次性 Token 的邀请用于撤销。**不要在这里加一个不存在的接口调用。**
 *
 * 同理，`GET /invitations` 不返回 Token，所以「我的邀请」页不能凭空提供接受按钮，
 * 必须由用户带着完整邀请链接（含 `token`）进入。
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
