import { userClient } from './user-client';
import type { ApiSuccessResponse } from './auth-types';
import type { UserSummary } from './auth-types';

export interface UpdateCurrentUserInput {
  nickname?: string;
  email?: string;
  avatar?: string;
}

/** 修改个人资料；只提交用户实际改动的字段，避免把邮箱等字段意外清空。 */
export async function updateCurrentUser(input: UpdateCurrentUserInput): Promise<UserSummary> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<UserSummary>>('/users/me', input),
  );
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * 修改密码。成功后服务端会吊销全部刷新会话，
 * 所以前端必须同时清本地会话并跳登录页，不能继续用旧凭据发请求。
 */
export async function changePassword(input: ChangePasswordInput): Promise<null> {
  return unwrap(
    await userClient.patch<ApiSuccessResponse<null>>('/users/me/password', input),
  );
}

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}
