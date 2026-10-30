import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface ApiSuccessResponse<T> {
  success: true;
  code: 0;
  message: string;
  data: T;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        code: 0 as const,
        message: '操作成功',
        data,
      })),
    );
  }
}
