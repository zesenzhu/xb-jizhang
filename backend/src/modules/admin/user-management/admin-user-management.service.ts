import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import type { AdminContext } from '../common/admin.types';
import type {
  AdminUserQuery,
  AdminUserRequestMetadata,
  UpdateUserStatusInput,
} from './admin-user-management.types';

const adminUserSelect = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { ledgerMemberships: true } },
} as const;

type AdminUserRecord = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***';
  return `${localPart.slice(0, 1)}***@${domain}`;
}

function toAdminUserSummary(user: AdminUserRecord) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: maskEmail(user.email),
    avatar: user.avatar,
    isActive: user.isActive,
    ledgerCount: user._count.ledgerMemberships,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class AdminUserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly permissionService: AdminPermissionService,
  ) {}

  async list(query: AdminUserQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const where: Prisma.UserWhereInput = {
      ...(query.keyword
        ? {
            OR: [
              { username: { contains: query.keyword, mode: 'insensitive' } },
              { nickname: { contains: query.keyword, mode: 'insensitive' } },
              { email: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              gte: query.createdFrom,
              lte: query.createdTo,
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: adminUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map(toAdminUserSummary),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async getDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: adminUserSelect,
    });
    if (!user) throw this.notFoundException();
    return toAdminUserSummary(user);
  }

  async updateStatus(
    userId: string,
    input: UpdateUserStatusInput,
    operator: AdminContext,
    metadata: AdminUserRequestMetadata,
  ) {
    const reason = this.permissionService.requireAuditReason(input.reason);
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });
    if (!before) throw this.notFoundException();
    if (before.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw this.conflictException();
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.user.updateMany({
        where: { id: userId, updatedAt: before.updatedAt },
        data: { isActive: input.status === 'ACTIVE' },
      });
      if (updateResult.count !== 1) throw this.conflictException();

      if (input.status === 'INACTIVE') {
        await transaction.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const after = await transaction.user.findUnique({
        where: { id: userId },
        select: adminUserSelect,
      });
      if (!after) throw this.notFoundException();

      await this.auditService.record(transaction, {
        adminUserId: operator.id,
        requestId: metadata.requestId,
        action: 'admin.user.status',
        targetType: 'User',
        targetId: userId,
        reason,
        beforeData: { isActive: before.isActive },
        afterData: { isActive: after.isActive },
        result: 'SUCCESS',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

      return toAdminUserSummary(after);
    });
  }

  private notFoundException(): NotFoundException {
    return new NotFoundException({
      code: 40402,
      message: '管理端资源不存在',
      data: null,
    });
  }

  private conflictException(): ConflictException {
    return new ConflictException({
      code: 40902,
      message: '资源版本已变化，请刷新后重试',
      data: null,
    });
  }
}
