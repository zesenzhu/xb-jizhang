import { userClient } from './user-client';
import type {
  ApiSuccessResponse,
  UserLoginResponse,
  UserRegisterResponse,
  UserSummary,
} from './auth-types';

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  nickname?: string;
  email?: string;
}

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function loginUser(input: LoginInput): Promise<UserLoginResponse> {
  return unwrap(await userClient.post<ApiSuccessResponse<UserLoginResponse>>('/auth/login', input));
}

export async function registerUser(input: RegisterInput): Promise<UserRegisterResponse> {
  return unwrap(
    await userClient.post<ApiSuccessResponse<UserRegisterResponse>>('/auth/register', input),
  );
}

export async function getCurrentUser(): Promise<UserSummary> {
  return unwrap(await userClient.get<ApiSuccessResponse<UserSummary>>('/users/me'));
}

export async function logoutUser(): Promise<void> {
  await userClient.post<ApiSuccessResponse<null>>('/auth/logout');
}
