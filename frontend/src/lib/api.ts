import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
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
  timestamp: string;
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout: 10000,
  withCredentials: true, // 必须开启以携带 HttpOnly access_token & refresh_token Cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

// 防止多个并发 401 请求同时触发刷新 Token 风暴的单例互斥锁
let refreshPromise: Promise<boolean> | null = null;

async function requestTokenRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      await api.post('/auth/refresh');
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 如果是 401 且未曾重试过，且不是认证登录本身接口，尝试刷新 Token
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      const refreshed = await requestTokenRefresh();
      if (refreshed) {
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export async function getHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
}

export async function loginApi(params: LoginParams): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', params);
  return response.data;
}

export async function registerApi(params: RegisterParams): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>('/auth/register', params);
  return response.data;
}

export async function logoutApi(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getMeApi(): Promise<SafeUser> {
  const response = await api.get<SafeUser>('/users/me');
  return response.data;
}
