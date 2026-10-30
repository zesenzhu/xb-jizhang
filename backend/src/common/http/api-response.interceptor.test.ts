import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  it('给定 Controller 返回业务数据，当响应完成，则统一包装成功响应', async () => {
    const interceptor = new ApiResponseInterceptor<unknown>();
    const context = {} as ExecutionContext;
    const next = { handle: () => of({ id: 'user-1' }) } as CallHandler;

    const response = await firstValueFrom(interceptor.intercept(context, next));

    expect(response).toEqual({
      success: true,
      code: 0,
      message: '操作成功',
      data: { id: 'user-1' },
    });
  });
});
