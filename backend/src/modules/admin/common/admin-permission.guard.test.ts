import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermissionGuard } from './admin-permission.guard';
import { AdminPermissionService } from './admin-permission.service';

describe('AdminPermissionGuard', () => {
  const createContext = (request: unknown): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('给定管理员拥有接口所需权限，当进入管理接口，则允许访问', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin:user:read']),
    };
    const permissionService = {
      hasPermission: jest.fn().mockReturnValue(true),
    };
    const guard = new AdminPermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as AdminPermissionService,
    );

    expect(
      guard.canActivate(
        createContext({ adminUser: { permissions: ['admin:user:read'] } }),
      ),
    ).toBe(true);
  });

  it('给定管理员缺少接口所需权限，当进入管理接口，则返回管理端权限错误', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin:transaction:write']),
    };
    const permissionService = {
      hasPermission: jest.fn().mockReturnValue(false),
    };
    const guard = new AdminPermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as AdminPermissionService,
    );

    expect(() =>
      guard.canActivate(createContext({ adminUser: { permissions: [] } })),
    ).toThrow(ForbiddenException);
  });
});
