import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AdminAuthenticatedRequest } from './admin-authenticated-request';
import { AdminPermissionService } from '../common/admin-permission.service';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_TYPE,
  ADMIN_AUTH_ERROR_CODE,
  ADMIN_TOKEN_AUDIENCE,
} from '../common/admin.constants';
import type { AdminTokenPayload } from '../common/admin.types';

export { ADMIN_ACCESS_TOKEN_COOKIE };

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly adminPermissionService: AdminPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const token = request.cookies?.[ADMIN_ACCESS_TOKEN_COOKIE];
    if (!token) throw this.authException();

    try {
      const payload = await this.jwtService.verifyAsync<AdminTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ADMIN_ACCESS_SECRET'),
        audience: ADMIN_TOKEN_AUDIENCE,
      });
      if (
        payload.type !== ADMIN_ACCESS_TOKEN_TYPE ||
        payload.aud !== ADMIN_TOKEN_AUDIENCE ||
        !payload.sub
      ) {
        throw this.authException();
      }
      const adminUser = await this.adminPermissionService.getContext(payload.sub);
      if (!adminUser) throw this.authException();
      request.adminUser = adminUser;
      return true;
    } catch {
      throw this.authException();
    }
  }

  private authException(): UnauthorizedException {
    return new UnauthorizedException({
      code: ADMIN_AUTH_ERROR_CODE,
      message: '管理员登录状态已失效',
      data: null,
    });
  }
}
