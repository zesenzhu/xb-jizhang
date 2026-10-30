import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AdminAuthenticatedRequest } from './admin-authenticated-request';
import { AdminAuthGuard, ADMIN_ACCESS_TOKEN_COOKIE } from './admin-auth.guard';
import { AdminPermissionService } from '../common/admin-permission.service';

describe('AdminAuthGuard', () => {
  const createContext = (request: AdminAuthenticatedRequest): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;

  it('给定普通用户访问 Cookie，当进入管理端接口，则拒绝访问且不查询管理员', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const permissionService = { getContext: jest.fn() };
    const guard = new AdminAuthGuard(
      jwtService as unknown as JwtService,
      { getOrThrow: jest.fn().mockReturnValue('admin-secret') } as unknown as ConfigService,
      permissionService as unknown as AdminPermissionService,
    );
    const request = {
      cookies: { [ADMIN_ACCESS_TOKEN_COOKIE]: 'user-token' },
    } as unknown as AdminAuthenticatedRequest;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'access', aud: 'app' });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(permissionService.getContext).not.toHaveBeenCalled();
  });

  it('给定有效管理员 Token，当进入管理端接口，则写入管理员上下文', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const permissionService = {
      getContext: jest.fn().mockResolvedValue({
        id: 'admin-1',
        username: 'operator',
        displayName: '运营人员',
        roles: ['OPERATOR'],
        permissions: ['admin:user:read'],
      }),
    };
    const guard = new AdminAuthGuard(
      jwtService as unknown as JwtService,
      { getOrThrow: jest.fn().mockReturnValue('admin-secret') } as unknown as ConfigService,
      permissionService as unknown as AdminPermissionService,
    );
    const request = {
      cookies: { [ADMIN_ACCESS_TOKEN_COOKIE]: 'admin-token' },
    } as unknown as AdminAuthenticatedRequest;
    jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-1', type: 'admin_access', aud: 'admin' });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.adminUser).toEqual(
      expect.objectContaining({ id: 'admin-1', permissions: ['admin:user:read'] }),
    );
  });
});
