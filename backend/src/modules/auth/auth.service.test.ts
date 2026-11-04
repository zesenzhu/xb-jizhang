import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const now = new Date('2026-10-30T08:00:00.000Z');
  const safeUser = {
    id: 'user-1',
    username: 'xiaobao',
    nickname: '小宝',
    email: 'xiaobao@example.com',
    avatar: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const createDependencies = () => {
    const transactionClient = {
      user: { create: jest.fn(), update: jest.fn() },
      ledger: { create: jest.fn() },
      ledgerMember: { create: jest.fn() },
      userLedgerPreference: { create: jest.fn() },
      category: { createMany: jest.fn() },
      refreshSession: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      ledgerMember: { findMany: jest.fn() },
      refreshSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const passwordService = {
      hash: jest.fn().mockResolvedValue('password-hash'),
      verify: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string, fallback: unknown) => {
        const values: Record<string, unknown> = {
          ACCESS_TOKEN_TTL_SECONDS: '900',
          REFRESH_SESSION_TTL_SECONDS: '2592000',
          JWT_ACCESS_SECRET: 'test-secret',
        };
        return values[key] ?? fallback;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
        throw new Error(`unexpected config key: ${key}`);
      }),
    };

    return {
      prisma,
      transactionClient,
      jwtService,
      passwordService,
      configService,
      service: new AuthService(
        prisma as unknown as PrismaService,
        jwtService as unknown as JwtService,
        passwordService,
        configService as unknown as ConfigService,
      ),
    };
  };

  it('给定合法注册信息，当用户注册，则事务性创建个人账本、Owner 成员和刷新会话', async () => {
    const dependencies = createDependencies();
    dependencies.transactionClient.user.create.mockResolvedValue(safeUser);
    dependencies.transactionClient.ledger.create.mockResolvedValue({
      id: 'ledger-1',
      name: '我的账本',
      type: 'PERSONAL',
      defaultCurrency: 'CNY',
    });
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({
      id: 'member-1',
    });
    dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });
    dependencies.transactionClient.refreshSession.create.mockResolvedValue({
      id: 'session-1',
    });

    const result = await dependencies.service.register({
      username: 'xiaobao',
      password: 'password-123',
      nickname: '小宝',
      email: ' XiaoBao@Example.com ',
    });

    expect(dependencies.transactionClient.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'xiaobao',
          email: 'xiaobao@example.com',
          passwordHash: 'password-hash',
        }),
      }),
    );
    expect(dependencies.transactionClient.ledgerMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ledgerId: 'ledger-1',
          userId: 'user-1',
          role: 'OWNER',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(dependencies.transactionClient.userLedgerPreference.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        currentLedgerId: 'ledger-1',
        defaultLedgerId: 'ledger-1',
      },
    });
    expect(dependencies.transactionClient.category.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ ledgerId: 'ledger-1', type: 'EXPENSE', isSystem: true }),
          expect.objectContaining({ ledgerId: 'ledger-1', type: 'INCOME', isSystem: true }),
        ]),
      }),
    );
    const defaultCategories = dependencies.transactionClient.category.createMany.mock.calls[0][0].data;
    expect(defaultCategories).toHaveLength(65);
    expect(defaultCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'EXPENSE', name: '餐饮', parentId: null }),
        expect.objectContaining({ type: 'EXPENSE', name: '早餐', parentId: expect.any(String) }),
        expect.objectContaining({ type: 'INCOME', name: '工资收入', parentId: null }),
        expect.objectContaining({ type: 'INCOME', name: '奖金', parentId: expect.any(String) }),
      ]),
    );
    expect(dependencies.transactionClient.refreshSession.create).toHaveBeenCalled();
    expect(result.user).toEqual(safeUser);
    expect(result.defaultLedger.id).toBe('ledger-1');
    expect(result.accessToken).toBe('access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(dependencies.jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'user-1', type: 'access' },
      { secret: 'test-secret', expiresIn: 900 },
    );
  });

  it('给定错误密码，当用户登录，则拒绝认证且不创建刷新会话', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.user.findUnique.mockResolvedValue({
      ...safeUser,
      passwordHash: 'stored-password-hash',
    });
    dependencies.passwordService.verify.mockResolvedValue(false);

    await expect(
      dependencies.service.login({
        username: 'xiaobao',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(dependencies.prisma.refreshSession.create).not.toHaveBeenCalled();
  });

  it('给定正确密码，当用户登录，则创建刷新会话并返回可访问账本', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.user.findUnique.mockResolvedValue({
      ...safeUser,
      passwordHash: 'stored-password-hash',
    });
    dependencies.passwordService.verify.mockResolvedValue(true);
    dependencies.prisma.ledgerMember.findMany.mockResolvedValue([
      {
        role: 'OWNER',
        joinedAt: now,
        ledger: {
          id: 'ledger-1',
          name: '我的账本',
          type: 'PERSONAL',
          defaultCurrency: 'CNY',
          icon: null,
          color: null,
          isArchived: false,
        },
      },
    ]);
    dependencies.prisma.refreshSession.create.mockResolvedValue({ id: 'session-1' });

    const result = await dependencies.service.login({
      username: 'xiaobao',
      password: 'password-123',
    });

    expect(result.user).toEqual(safeUser);
    expect(result.ledgers[0]).toEqual(
      expect.objectContaining({ id: 'ledger-1', memberRole: 'OWNER' }),
    );
    expect(dependencies.prisma.refreshSession.create).toHaveBeenCalled();
  });

  it('给定有效刷新 Token，当刷新会话，则轮换旧会话并返回新凭证', async () => {
    const dependencies = createDependencies();
    const refreshToken = 'refresh-token';
    dependencies.prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      userId: 'user-1',
      expiresAt: new Date('2026-11-30T08:00:00.000Z'),
      revokedAt: null,
      replacedBySessionId: null,
      user: safeUser,
    });
    dependencies.transactionClient.refreshSession.create.mockResolvedValue({
      id: 'session-2',
    });
    dependencies.transactionClient.refreshSession.update.mockResolvedValue({
      id: 'session-1',
    });

    const result = await dependencies.service.refresh(refreshToken);

    expect(dependencies.transactionClient.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          replacedBySessionId: 'session-2',
        }),
      }),
    );
    expect(result.accessToken).toBe('access-token');
    expect(typeof result.refreshToken).toBe('string');
  });

  it('给定已经轮换的旧 Token，当再次刷新，则撤销用户会话并拒绝请求', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date('2026-11-30T08:00:00.000Z'),
      revokedAt: now,
      replacedBySessionId: 'session-2',
      user: safeUser,
    });

    await expect(dependencies.service.refresh('replayed-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(dependencies.prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('给定当前密码正确，当修改密码，则更新密码并撤销全部刷新会话', async () => {
    const dependencies = createDependencies();
    dependencies.prisma.user.findUnique.mockResolvedValue({
      passwordHash: 'stored-password-hash',
      isActive: true,
    });
    dependencies.passwordService.verify.mockResolvedValue(true);

    await dependencies.service.changePassword('user-1', {
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    });

    expect(dependencies.transactionClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(dependencies.transactionClient.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      }),
    );
  });
});
