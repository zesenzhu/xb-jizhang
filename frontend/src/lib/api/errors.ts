import axios from 'axios';

export interface ApiErrorBody {
  success: false;
  code: number;
  message: string;
  data: unknown;
}

export class ApiRequestError extends Error {
  readonly code: number;
  readonly status: number | undefined;
  readonly data: unknown;

  constructor(body: ApiErrorBody, status?: number) {
    super(body.message);
    this.name = 'ApiRequestError';
    this.code = body.code;
    this.status = status;
    this.data = body.data;
  }
}

export function toApiError(error: unknown): ApiRequestError | unknown {
  if (error instanceof ApiRequestError) return error;

  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    if (isApiErrorBody(body)) {
      return new ApiRequestError(body, error.response?.status);
    }
    return new ApiRequestError(
      {
        success: false,
        code: error.response?.status ?? 50001,
        message: error.message || '网络请求失败',
        data: null,
      },
      error.response?.status,
    );
  }

  return error;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    body.success === false &&
    typeof body.code === 'number' &&
    typeof body.message === 'string' &&
    'data' in body
  );
}
