import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AdminAuthenticatedRequest } from './admin-authenticated-request';
import type { AdminContext } from '../common/admin.types';

export const CurrentAdminUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminContext => {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    if (!request.adminUser) {
      throw new UnauthorizedException({
        code: 40103,
        message: '管理员登录状态已失效',
        data: null,
      });
    }
    return request.adminUser;
  },
);
