import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { AdminAuthenticatedRequest } from './admin-authenticated-request';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { getPositiveSeconds } from '../../auth/auth.config';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
} from '../common/admin.constants';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.adminAuthService.login(dto, { userAgent });
    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    return result.user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: AdminAuthenticatedRequest,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.adminAuthService.refresh(
        request.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE] ?? '',
        { userAgent },
      );
      this.setSessionCookies(response, result.accessToken, result.refreshToken);
      return null;
    } catch (error) {
      this.clearSessionCookies(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: AdminAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.adminAuthService.logout(request.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE]);
    this.clearSessionCookies(response);
    return null;
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  getMe(@Req() request: AdminAuthenticatedRequest) {
    return this.adminAuthService.getMe(request.adminUser?.id ?? '');
  }

  private setSessionCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(
      ADMIN_ACCESS_TOKEN_COOKIE,
      accessToken,
      this.cookieOptions(
        getPositiveSeconds(this.configService, 'ADMIN_ACCESS_TOKEN_TTL_SECONDS', 900),
      ),
    );
    response.cookie(ADMIN_REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.cookieOptions(
        getPositiveSeconds(
          this.configService,
          'ADMIN_REFRESH_SESSION_TTL_SECONDS',
          2_592_000,
        ),
      ),
      path: '/api/admin/auth',
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(ADMIN_ACCESS_TOKEN_COOKIE, this.cookieOptions(0));
    response.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE, {
      ...this.cookieOptions(0),
      path: '/api/admin/auth',
    });
  }

  private cookieOptions(maxAgeSeconds: number): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds * 1000,
    };
  }
}
