import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminPasswordService } from '../common/admin-password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  const now = new Date('2026-10-30T08:00:00.000Z');
  const adminUser = {
    id: 'admin-1',
    username: 'operator',
    passwordHash: 'password-hash',
    displayName: '运营人员',
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    roles: [
      {
        role: {
          code: 'OPERATOR',
          permissions: [{ permission: { code: 'admin:user:read' } }],
        },
      },
    ],
  };

  const createDependencies = () => {
    const transactionClient = {
      adminUser: { update: jest.fn() },
      adminRefreshSession: { create: jest.fn(), update: jest.fn() },
    };
    const prisma = {
      adminUser: { findUnique: jest.fn(), update: jest.fn() },
      adminRefreshSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('admin-access-token') };
    const passwordService = { verify: jest.fn().mockResolvedValue(true) };
    const configService = {
      get: jest.fn((key: string, fallback: unknown) => {
        const values: Record<string, unknown> = {
          ACCESS_TOKEN_TTL_SECONDS: '900',
          REFRESH_SESSION_TTL_SECONDS: '2592000',
          JWT_ADMIN_ACCESS_SECRET: 'admin-secret',
        };
        return values[key] ?? fallback;
      }),
      getOrThrow: jest.fn().mockReturnValue('admin-secret'),
    };

    return {
      prisma,
      transactionClient,
      jwtService,
      passwordService,
      configService,
      service: new AdminAuthService(
        prisma as unknown as PrismaService,
        jwtService as unknown as JwtService,
        passwordService as unknown as AdminPasswordService,
        configService as unknown as ConfigService,
      ),
    };
  };

  it('给定有效管理员凭证，当管理员登录，则签发 admin audience Token 并创建管理会话', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.adminUser.findUnique.mockResolvedValue(adminUser);
    dependencies.transactionClient.adminUser.update.mockResolvedValue(adminUser);
    dependencies.transactionClient.adminRefreshSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await dependencies.service.login(
      { username: 'operator', password: 'admin-password' },
      { userAgent: 'test-agent' },
    );

    expect(result.user).toEqual(
      expect.objectContaining({ id: 'admin-1', username: 'operator', roles: ['OPERATOR'] }),
    );
    expect(result).not.toHaveProperty('passwordHash');
    expect(dependencies.jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'admin-1', type: 'admin_access' },
      expect.objectContaining({ secret: 'admin-secret', audience: 'admin', expiresIn: 900 }),
    );
    expect(dependencies.transactionClient.adminRefreshSession.create).toHaveBeenCalled();
  });

  it('给定停用管理员，当管理员登录，则拒绝并返回管理端认证异常', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.adminUser.findUnique.mockResolvedValue({ ...adminUser, isActive: false });

    await expect(
      dependencies.service.login({ username: 'operator', password: 'admin-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dependencies.passwordService.verify).not.toHaveBeenCalled();
  });

  it('给定有效刷新凭证，当管理员刷新，则撤销旧会话并轮换新凭证', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.adminRefreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tokenHash: 'old-hash',
      expiresAt: new Date('2026-11-30T08:00:00.000Z'),
      revokedAt: null,
      replacedBySessionId: null,
      adminUser: adminUser,
    });
    dependencies.transactionClient.adminRefreshSession.create.mockResolvedValue({ id: 'session-2' });

    const result = await dependencies.service.refresh('old-refresh-token');

    expect(result.refreshToken).toBeDefined();
    expect(dependencies.transactionClient.adminRefreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date), replacedBySessionId: 'session-2' }),
      }),
    );
  });

  it('给定已经轮换的旧刷新凭证，当再次刷新，则撤销该管理员全部管理会话', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.adminRefreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      revokedAt: now,
      replacedBySessionId: 'session-2',
      adminUserId: 'admin-1',
      adminUser,
    });

    await expect(dependencies.service.refresh('replayed-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(dependencies.prisma.adminRefreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adminUserId: 'admin-1', revokedAt: null },
      }),
    );
  });
});
