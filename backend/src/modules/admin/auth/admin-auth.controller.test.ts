import { ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthController', () => {
  const configService = {
    get: jest.fn((key: string, fallback: number) => fallback),
  } as unknown as ConfigService;

  const createResponse = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  it('给定管理员登录成功，当 Controller 返回结果，则只写入管理端 Cookie 不返回 Token', async () => {
    const authService = {
      login: jest.fn().mockResolvedValue({
        user: { id: 'admin-1', username: 'operator' },
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
      }),
    };
    const controller = new AdminAuthController(
      authService as unknown as AdminAuthService,
      configService,
    );
    const response = createResponse();

    const result = await controller.login(
      { username: 'operator', password: 'admin-password' },
      'test-agent',
      response as never,
    );

    expect(result).toEqual({ id: 'admin-1', username: 'operator' });
    expect(result).not.toHaveProperty('accessToken');
    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(response.cookie.mock.calls[0][0]).toBe('admin_access_token');
    expect(response.cookie.mock.calls[1][0]).toBe('admin_refresh_token');
  });

  it('给定刷新失败，当 Controller 处理异常，则清理管理端两个 Cookie', async () => {
    const authService = {
      refresh: jest.fn().mockRejectedValue(new Error('refresh failed')),
    };
    const controller = new AdminAuthController(
      authService as unknown as AdminAuthService,
      configService,
    );
    const response = createResponse();

    await expect(
      controller.refresh({ cookies: { admin_refresh_token: 'old-token' } } as never, 'agent', response as never),
    ).rejects.toThrow('refresh failed');
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});
