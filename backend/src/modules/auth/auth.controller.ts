import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { AuthService } from './auth.service';
import { getPositiveSeconds } from './auth.config';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto, { userAgent });
    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      defaultLedger: result.defaultLedger,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, { userAgent });
    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      ledgers: result.ledgers,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.refresh(
        request.cookies?.[REFRESH_TOKEN_COOKIE] ?? '',
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
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.logout(request.cookies?.[REFRESH_TOKEN_COOKIE]);
    this.clearSessionCookies(response);
    return null;
  }

  private setSessionCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      this.cookieOptions(getPositiveSeconds(this.configService, 'ACCESS_TOKEN_TTL_SECONDS', 900)),
    );
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.cookieOptions(
        getPositiveSeconds(this.configService, 'REFRESH_SESSION_TTL_SECONDS', 2_592_000),
      ),
      path: '/api/auth',
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions(0));
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.cookieOptions(0),
      path: '/api/auth',
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
