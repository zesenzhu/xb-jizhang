import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminAuthenticatedRequest } from '../auth/admin-authenticated-request';
import { ADMIN_PERMISSION_ERROR_CODE } from './admin.constants';
import { ADMIN_PERMISSIONS_KEY } from './admin-permission.decorator';
import { AdminPermissionService } from './admin-permission.service';
import type { AdminPermissionCode } from './admin.type-aliases';

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminPermissionService: AdminPermissionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<AdminPermissionCode[]>(ADMIN_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    if (!request.adminUser) {
      throw new UnauthorizedException({
        code: 40103,
        message: '管理员登录状态已失效',
        data: null,
      });
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      this.adminPermissionService.hasPermission(request.adminUser!, permission),
    );
    if (!hasAllPermissions) {
      throw new ForbiddenException({
        code: ADMIN_PERMISSION_ERROR_CODE,
        message: '管理员权限不足',
        data: null,
      });
    }
    return true;
  }
}
