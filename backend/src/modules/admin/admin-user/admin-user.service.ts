import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import type { AdminContext } from '../common/admin.types';
import type {
  AdminUserQuery,
  AdminUserRequestMetadata,
  UpdateAdminUserInput,
} from './admin-user.types';

const adminUserSelect = {
  id: true,
  username: true,
  displayName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { code: true } } } },
} as const;

type AdminUserRecord = Prisma.AdminUserGetPayload<{ select: typeof adminUserSelect }>;

function toAdminUserSummary(user: AdminUserRecord) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isActive: user.isActive,
    roles: user.roles.map(({ role }) => role.code),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class AdminUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly permissionService: AdminPermissionService,
  ) {}

  async list(query: AdminUserQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const where: Prisma.AdminUserWhereInput = {
      ...(query.keyword
        ? {
            OR: [
              { username: { contains: query.keyword, mode: 'insensitive' } },
              { displayName: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: adminUserSelect,
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return {
      items: items.map(toAdminUserSummary),
      total,
      page,
      pageSize,
      hasNextPage: page * pageSize < total,
    };
  }

  async update(
    adminUserId: string,
    input: UpdateAdminUserInput,
    operator: AdminContext,
    metadata: AdminUserRequestMetadata,
  ) {
    const reason = this.permissionService.requireAuditReason(input.reason);
    const before = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: adminUserSelect,
    });
    if (!before) throw this.notFoundException();
    if (before.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw this.conflictException();
    }

    const beforeRoleCodes = before.roles.map(({ role }) => role.code);
    const nextRoleCodes = input.roleCodes ?? beforeRoleCodes;
    const removesSuperAdmin =
      beforeRoleCodes.includes('SUPER_ADMIN') && !nextRoleCodes.includes('SUPER_ADMIN');
    const disablesSuperAdmin = beforeRoleCodes.includes('SUPER_ADMIN') && input.isActive === false;
    if (removesSuperAdmin || disablesSuperAdmin) {
      const activeSuperAdminCount = await this.prisma.adminUser.count({
        where: {
          isActive: true,
          roles: { some: { role: { code: 'SUPER_ADMIN' } } },
        },
      });
      if (activeSuperAdminCount <= 1) throw this.lastSuperAdminException();
    }

    return this.prisma.$transaction(async (transaction) => {
      let roleRecords: Array<{ id: string; code: string }> = [];
      if (input.roleCodes) {
        roleRecords = await transaction.adminRole.findMany({
          where: { code: { in: input.roleCodes } },
          select: { id: true, code: true },
        });
        if (roleRecords.length !== new Set(input.roleCodes).size) {
          throw new BadRequestException({
            code: 40001,
            message: '管理员角色不存在',
            data: null,
          });
        }
      }

      const updateResult = await transaction.adminUser.updateMany({
        where: { id: adminUserId, updatedAt: before.updatedAt },
        data: { isActive: input.isActive ?? before.isActive },
      });
      if (updateResult.count !== 1) throw this.conflictException();

      if (input.roleCodes) {
        await transaction.adminUserRole.deleteMany({ where: { adminUserId } });
        await transaction.adminUserRole.createMany({
          data: roleRecords.map(({ id: roleId }) => ({ adminUserId, roleId })),
        });
      }

      await transaction.adminRefreshSession.updateMany({
        where: { adminUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const after = await transaction.adminUser.findUnique({
        where: { id: adminUserId },
        select: adminUserSelect,
      });
      if (!after) throw this.notFoundException();

      await this.auditService.record(transaction, {
        adminUserId: operator.id,
        requestId: metadata.requestId,
        action: 'admin.admin_user.update',
        targetType: 'AdminUser',
        targetId: adminUserId,
        reason,
        beforeData: { isActive: before.isActive, roles: beforeRoleCodes },
        afterData: {
          isActive: after.isActive,
          roles: after.roles.map(({ role }) => role.code),
        },
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

  private lastSuperAdminException(): ConflictException {
    return new ConflictException({
      code: 40902,
      message: '不能停用或降级最后一个超级管理员',
      data: null,
    });
  }
}
