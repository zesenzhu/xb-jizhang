import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import type { AccessTokenPayload } from './auth.types';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) throw new UnauthorizedException('登录状态已失效');

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access' || !payload.sub) {
        throw new UnauthorizedException('登录状态已失效');
      }
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
  }
}
