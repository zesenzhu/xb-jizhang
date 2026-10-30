import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { toApiError } from './errors';
import { createRefreshQueue } from './refresh-queue';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _authRetry?: boolean;
}

export interface ApiClientOptions {
  refreshPath: string;
  skipRefreshPaths?: string[];
  onRefreshFailure: () => void;
}

export function shouldSkipAuthRefresh(
  url: string | undefined,
  paths: readonly string[],
): boolean {
  return paths.some((path) => url === path || url?.startsWith(`${path}?`));
}

export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
    timeout: 10000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const refreshClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
    timeout: 10000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const refreshQueue = createRefreshQueue();

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: unknown) => {
      const responseStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
      const requestConfig = axios.isAxiosError(error)
        ? (error.config as RetriableRequestConfig | undefined)
        : undefined;
      const isAuthRequest = shouldSkipAuthRefresh(requestConfig?.url, [
        options.refreshPath,
        ...(options.skipRefreshPaths ?? []),
      ]);

      if (
        responseStatus !== 401 ||
        requestConfig === undefined ||
        requestConfig._authRetry === true ||
        isAuthRequest
      ) {
        return Promise.reject(toApiError(error));
      }

      requestConfig._authRetry = true;
      try {
        await refreshQueue.run(async () => {
          await refreshClient.post(options.refreshPath);
        });
        return client.request(requestConfig as AxiosRequestConfig);
      } catch (refreshError) {
        options.onRefreshFailure();
        return Promise.reject(toApiError(refreshError));
      }
    },
  );

  return client;
}
