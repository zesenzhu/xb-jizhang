import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('登录状态已失效');
    }
    return request.user;
  },
);
