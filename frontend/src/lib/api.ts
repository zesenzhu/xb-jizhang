import axios from 'axios';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '@/lib/api/user-auth-api';
import type {
  LoginParams,
  LoginResponse,
  RegisterParams,
  RegisterResponse,
  SafeUser,
} from '@/types/auth';

export interface HealthResponse {
  name: string;
  status: 'ok';
  database: 'ok';
  schema: 'ok';
  timestamp: string;
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
}

export async function loginApi(params: LoginParams): Promise<LoginResponse> {
  return loginUser(params);
}

export async function registerApi(params: RegisterParams): Promise<RegisterResponse> {
  return registerUser(params);
}

export async function logoutApi(): Promise<void> {
  await logoutUser();
}

export async function getMeApi(): Promise<SafeUser> {
  return getCurrentUser();
}
