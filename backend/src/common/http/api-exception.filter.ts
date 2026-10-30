import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

interface ExceptionResponseBody {
  code?: number;
  message?: string | string[];
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorCode(status: number): number {
  const codes: Record<number, number> = {
    [HttpStatus.BAD_REQUEST]: 40001,
    [HttpStatus.UNAUTHORIZED]: 40101,
    [HttpStatus.FORBIDDEN]: 40301,
    [HttpStatus.NOT_FOUND]: 40401,
    [HttpStatus.CONFLICT]: 40901,
    [HttpStatus.TOO_MANY_REQUESTS]: 42901,
  };
  return codes[status] ?? 50001;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawBody = isHttpException ? exception.getResponse() : null;
    const body: ExceptionResponseBody = isRecord(rawBody) ? rawBody : {};
    const messageValue = body.message;
    const message = Array.isArray(messageValue)
      ? '请求参数校验失败'
      : messageValue ?? (typeof rawBody === 'string' ? rawBody : '服务器内部错误');
    const data = Array.isArray(messageValue)
      ? { details: messageValue }
      : body.data ?? null;

    response.status(status).json({
      success: false,
      code: body.code ?? getErrorCode(status),
      message,
      data,
    });
  }
}
