import { adminClient } from './admin-client';
import type { AdminSummary, ApiSuccessResponse } from './auth-types';

export interface AdminLoginInput {
  username: string;
  password: string;
}

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function loginAdmin(input: AdminLoginInput): Promise<AdminSummary> {
  return unwrap(await adminClient.post<ApiSuccessResponse<AdminSummary>>('/admin/auth/login', input));
}

export async function getCurrentAdmin(): Promise<AdminSummary> {
  return unwrap(await adminClient.get<ApiSuccessResponse<AdminSummary>>('/admin/auth/me'));
}

export async function logoutAdmin(): Promise<void> {
  await adminClient.post<ApiSuccessResponse<null>>('/admin/auth/logout');
}
