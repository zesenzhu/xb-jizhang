import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  const createResponse = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  const configService = {
    get: jest.fn((key: string, fallback: number) => fallback),
  } as unknown as ConfigService;

  it('给定注册成功，当 Controller 返回结果，则只写入 Cookie 不返回 Token', async () => {
    const authService = {
      register: jest.fn().mockResolvedValue({
        user: { id: 'user-1' },
        defaultLedger: { id: 'ledger-1' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
      configService,
    );
    const response = createResponse();

    const result = await controller.register(
      { username: 'xiaobao', password: 'password-123' },
      'test-agent',
      response as never,
    );

    expect(result).toEqual({
      user: { id: 'user-1' },
      defaultLedger: { id: 'ledger-1' },
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it('给定刷新失败，当 Controller 处理异常，则清理两个认证 Cookie', async () => {
    const authService = {
      refresh: jest.fn().mockRejectedValue(new Error('refresh failed')),
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
      configService,
    );
    const response = createResponse();

    await expect(
      controller.refresh({ cookies: { refresh_token: 'old-token' } } as never, 'agent', response as never),
    ).rejects.toThrow('refresh failed');
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});
