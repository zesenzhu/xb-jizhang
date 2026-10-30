import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminContext } from './admin.types';
import type { AdminPermissionCode } from './admin.type-aliases';

@Injectable()
export class AdminPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  hasPermission(context: AdminContext, permission: AdminPermissionCode): boolean {
    return context.permissions.includes(permission);
  }

  validateAuditReason(reason?: string | null): boolean {
    const normalizedReason = reason?.trim();
    return Boolean(normalizedReason && normalizedReason.length <= 500);
  }

  requireAuditReason(reason?: string | null): string {
    const normalizedReason = reason?.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      throw new UnprocessableEntityException({
        code: 42201,
        message: '高风险操作必须填写合法原因',
        data: null,
      });
    }
    return normalizedReason;
  }

  async getContext(adminUserId: string): Promise<AdminContext | null> {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        username: true,
        displayName: true,
        isActive: true,
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
      },
    });

    if (!adminUser || !adminUser.isActive) return null;

    const roles = adminUser.roles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        adminUser.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ];

    return {
      id: adminUser.id,
      username: adminUser.username,
      displayName: adminUser.displayName,
      roles,
      permissions,
    };
  }
}
