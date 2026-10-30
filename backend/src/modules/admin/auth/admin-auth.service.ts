import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { getPositiveSeconds } from '../../auth/auth.config';
import { AdminPasswordService } from '../common/admin-password.service';
import {
  ADMIN_ACCESS_TOKEN_TYPE,
  ADMIN_AUTH_ERROR_CODE,
  ADMIN_TOKEN_AUDIENCE,
} from '../common/admin.constants';
import type { AdminLoginResult, AdminSessionMetadata, SafeAdminUser } from '../common/admin.types';
import type { AdminLoginInput } from './admin-auth.types';

const adminUserSelect = {
  id: true,
  username: true,
  passwordHash: true,
  displayName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: {
        select: {
          code: true,
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  },
} as const;

type AdminUserRecord = Prisma.AdminUserGetPayload<{ select: typeof adminUserSelect }>;
type TransactionClient = Prisma.TransactionClient;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toSafeAdminUser(user: AdminUserRecord): SafeAdminUser {
  const roles = user.roles.map(({ role }) => role.code);
  const permissions = [
    ...new Set(
      user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.code),
      ),
    ),
  ];

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isActive: user.isActive,
    roles,
    permissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: AdminPasswordService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    input: AdminLoginInput,
    metadata: AdminSessionMetadata = {},
  ): Promise<AdminLoginResult> {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { username: input.username },
      select: adminUserSelect,
    });

    if (
      !adminUser ||
      !adminUser.isActive ||
      !(await this.passwordService.verify(input.password, adminUser.passwordHash))
    ) {
      throw this.authException('管理员账号或密码错误');
    }

    const refreshToken = this.createRefreshToken();
    const updatedUser = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.adminUser.update({
        where: { id: adminUser.id },
        data: { lastLoginAt: new Date() },
        select: adminUserSelect,
      });
      await this.createRefreshSession(transaction, adminUser.id, refreshToken, metadata);
      return updated;
    });

    return {
      user: toSafeAdminUser(updatedUser),
      accessToken: await this.createAccessToken(adminUser.id),
      refreshToken,
    };
  }

  async refresh(
    refreshToken: string,
    metadata: AdminSessionMetadata = {},
  ): Promise<AdminLoginResult> {
    if (!refreshToken) throw this.authException('管理员刷新凭证无效');

    const session = await this.prisma.adminRefreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: {
        id: true,
        adminUserId: true,
        expiresAt: true,
        revokedAt: true,
        replacedBySessionId: true,
        adminUser: { select: adminUserSelect },
      },
    });

    if (!session) throw this.authException('管理员刷新凭证无效');
    if (session.revokedAt || session.replacedBySessionId) {
      await this.revokeAllSessions(session.adminUserId);
      throw this.authException('管理员刷新凭证已失效');
    }
    if (session.expiresAt <= new Date() || !session.adminUser.isActive) {
      throw this.authException('管理员刷新凭证已失效');
    }

    const nextRefreshToken = this.createRefreshToken();
    await this.prisma.$transaction(async (transaction) => {
      const createdSession = await this.createRefreshSession(
        transaction,
        session.adminUserId,
        nextRefreshToken,
        metadata,
      );
      await transaction.adminRefreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          replacedBySessionId: createdSession.id,
          lastUsedAt: new Date(),
        },
      });
    });

    return {
      user: toSafeAdminUser(session.adminUser),
      accessToken: await this.createAccessToken(session.adminUserId),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.adminRefreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { id: true, revokedAt: true },
    });
    if (!session || session.revokedAt) return;

    await this.prisma.adminRefreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(adminUserId: string): Promise<SafeAdminUser> {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: adminUserSelect,
    });
    if (!adminUser || !adminUser.isActive) {
      throw this.authException('管理员登录状态已失效');
    }
    return toSafeAdminUser(adminUser);
  }

  async revokeAllSessions(adminUserId: string): Promise<void> {
    await this.prisma.adminRefreshSession.updateMany({
      where: { adminUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshSession(
    transaction: PrismaClient | TransactionClient,
    adminUserId: string,
    refreshToken: string,
    metadata: AdminSessionMetadata,
  ): Promise<{ id: string }> {
    const ttlSeconds = getPositiveSeconds(
      this.configService,
      'ADMIN_REFRESH_SESSION_TTL_SECONDS',
      2_592_000,
    );
    return transaction.adminRefreshSession.create({
      data: {
        adminUserId,
        tokenHash: hashToken(refreshToken),
        deviceName: metadata.deviceName,
        userAgent: metadata.userAgent,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
      select: { id: true },
    });
  }

  private createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private async createAccessToken(adminUserId: string): Promise<string> {
    const ttlSeconds = getPositiveSeconds(
      this.configService,
      'ADMIN_ACCESS_TOKEN_TTL_SECONDS',
      900,
    );
    const secret = this.configService.getOrThrow<string>('JWT_ADMIN_ACCESS_SECRET');
    return this.jwtService.signAsync(
      {
        sub: adminUserId,
        type: ADMIN_ACCESS_TOKEN_TYPE,
      },
      {
        secret,
        audience: ADMIN_TOKEN_AUDIENCE,
        expiresIn: ttlSeconds,
      },
    );
  }

  private authException(message: string): UnauthorizedException {
    return new UnauthorizedException({
      code: ADMIN_AUTH_ERROR_CODE,
      message,
      data: null,
    });
  }
}
