import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getPositiveSeconds } from './auth.config';
import {
  AuthSessionResult,
  ChangePasswordInput,
  LoginInput,
  LoginResult,
  RegisterInput,
  RegisterResult,
  SessionMetadata,
  normalizeEmail,
  toSafeUser,
} from './auth.types';
import { PasswordService } from './password.service';

const safeUserSelect = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type TransactionClient = Prisma.TransactionClient;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    input: RegisterInput,
    metadata: SessionMetadata = {},
  ): Promise<RegisterResult> {
    const passwordHash = await this.passwordService.hash(input.password);
    const refreshToken = this.createRefreshToken();
    const normalizedEmail = normalizeEmail(input.email);

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            username: input.username,
            passwordHash,
            nickname: input.nickname?.trim() || null,
            email: normalizedEmail,
          },
          select: safeUserSelect,
        });
        const ledger = await transaction.ledger.create({
          data: {
            name: '我的账本',
            type: 'PERSONAL',
            creatorId: user.id,
            defaultCurrency: 'CNY',
          },
        });

        await transaction.ledgerMember.create({
          data: {
            ledgerId: ledger.id,
            userId: user.id,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });
        await this.createRefreshSession(transaction, user.id, refreshToken, metadata);

        return { user, ledger };
      });
      const accessToken = await this.createAccessToken(created.user.id);

      return {
        user: toSafeUser(created.user),
        defaultLedger: {
          id: created.ledger.id,
          name: created.ledger.name,
          type: created.ledger.type,
          defaultCurrency: created.ledger.defaultCurrency,
          memberRole: 'OWNER',
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('用户名或邮箱已被占用');
      }
      throw error;
    }
  }

  async login(
    input: LoginInput,
    metadata: SessionMetadata = {},
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
      select: { ...safeUserSelect, passwordHash: true },
    });

    if (!user || !user.isActive || !(await this.passwordService.verify(input.password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const refreshToken = this.createRefreshToken();
    await this.createRefreshSession(this.prisma, user.id, refreshToken, metadata);
    const ledgers = await this.prisma.ledgerMember.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        joinedAt: true,
        ledger: {
          select: {
            id: true,
            name: true,
            type: true,
            defaultCurrency: true,
            icon: true,
            color: true,
            isArchived: true,
          },
        },
      },
    });
    const accessToken = await this.createAccessToken(user.id);

    return {
      user: toSafeUser(user),
      ledgers: ledgers.map(({ ledger, role, joinedAt }) => ({
        ...ledger,
        memberRole: role,
        joinedAt,
      })),
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, metadata: SessionMetadata = {}): Promise<AuthSessionResult> {
    const tokenHash = hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) throw this.refreshTokenException('刷新凭证无效');
    if (session.revokedAt || session.replacedBySessionId) {
      await this.revokeUserSessions(session.userId);
      throw this.refreshTokenException('刷新凭证已失效');
    }
    if (session.expiresAt <= new Date() || !session.user.isActive) {
      throw this.refreshTokenException('刷新凭证已失效');
    }

    const nextRefreshToken = this.createRefreshToken();
    await this.prisma.$transaction(async (transaction) => {
      const createdSession = await this.createRefreshSession(
        transaction,
        session.userId,
        nextRefreshToken,
        metadata,
      );
      await transaction.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          replacedBySessionId: createdSession.id,
        },
      });
      return createdSession;
    });
    const accessToken = await this.createAccessToken(session.userId);

    return {
      user: toSafeUser(session.user),
      accessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { id: true, revokedAt: true },
    });
    if (!session || session.revokedAt) return;

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, isActive: true },
    });
    if (!user || !user.isActive || !(await this.passwordService.verify(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('当前密码错误');
    }

    const passwordHash = await this.passwordService.hash(input.newPassword);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await transaction.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async createRefreshSession(
    transaction: PrismaClient | TransactionClient,
    userId: string,
    refreshToken: string,
    metadata: SessionMetadata,
  ): Promise<{ id: string }> {
    const ttlSeconds = getPositiveSeconds(
      this.configService,
      'REFRESH_SESSION_TTL_SECONDS',
      2_592_000,
    );
    return transaction.refreshSession.create({
      data: {
        userId,
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

  private async createAccessToken(userId: string): Promise<string> {
    const ttlSeconds = getPositiveSeconds(this.configService, 'ACCESS_TOKEN_TTL_SECONDS', 900);
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    return this.jwtService.signAsync(
      { sub: userId, type: 'access' },
      { secret, expiresIn: ttlSeconds },
    );
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private refreshTokenException(message: string): UnauthorizedException {
    return new UnauthorizedException({
      code: 40102,
      message,
      data: null,
    });
  }
}
