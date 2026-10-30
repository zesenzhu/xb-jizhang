import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { AuthGuard, ACCESS_TOKEN_COOKIE } from './auth.guard';

describe('AuthGuard', () => {
  const createContext = (request: AuthenticatedRequest): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as ExecutionContext;

  it('给定请求没有访问 Cookie，当进入受保护接口，则拒绝访问', async () => {
    const jwtService = { verifyAsync: jest.fn() };
    const configService = { getOrThrow: jest.fn().mockReturnValue('secret') };
    const guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );

    await expect(
      guard.canActivate(createContext({ cookies: {} } as AuthenticatedRequest)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('给定有效访问 Cookie，当进入受保护接口，则写入当前用户上下文', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', type: 'access' }),
    };
    const configService = { getOrThrow: jest.fn().mockReturnValue('secret') };
    const guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
    const request = {
      cookies: { [ACCESS_TOKEN_COOKIE]: 'access-token' },
    } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1' });
  });
});
