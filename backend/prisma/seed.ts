import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PasswordService } from '../src/modules/auth/password.service';
import {
  ADMIN_PERMISSION_CODES,
  ADMIN_ROLE_CODES,
  BUILT_IN_ADMIN_ROLE_PERMISSIONS,
} from '../src/modules/admin/common/admin.constants';

const permissionNames: Record<(typeof ADMIN_PERMISSION_CODES)[number], string> = {
  'admin:user:read': '查询用户',
  'admin:user:status': '管理用户状态',
  'admin:ledger:read': '查询账本',
  'admin:ledger:status': '管理账本状态',
  'admin:transaction:read_sensitive': '查看敏感账单',
  'admin:transaction:write': '修改账单',
  'admin:config:read': '查询系统配置',
  'admin:config:write': '修改系统配置',
  'admin:audit:read': '查询管理审计',
  'admin:admin_user:manage': '管理管理员账号',
};

const roleNames: Record<(typeof ADMIN_ROLE_CODES)[number], string> = {
  SUPER_ADMIN: '超级管理员',
  OPERATOR: '运营人员',
  AUDITOR: '审计人员',
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const passwordService = new PasswordService();

  try {
    await prisma.$transaction(async (transaction) => {
      const permissions = new Map<string, { id: string }>();
      for (const code of ADMIN_PERMISSION_CODES) {
        const permission = await transaction.adminPermission.upsert({
          where: { code },
          update: { name: permissionNames[code] },
          create: { code, name: permissionNames[code] },
          select: { id: true },
        });
        permissions.set(code, permission);
      }

      const roles = new Map<string, { id: string }>();
      for (const code of ADMIN_ROLE_CODES) {
        const role = await transaction.adminRole.upsert({
          where: { code },
          update: { name: roleNames[code], isBuiltIn: true },
          create: { code, name: roleNames[code], isBuiltIn: true },
          select: { id: true },
        });
        roles.set(code, role);

        for (const permissionCode of BUILT_IN_ADMIN_ROLE_PERMISSIONS[code]) {
          const permission = permissions.get(permissionCode);
          if (!permission) throw new Error(`Missing permission: ${permissionCode}`);
          await transaction.adminRolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: permission.id },
            },
            update: {},
            create: { roleId: role.id, permissionId: permission.id },
          });
        }
      }

      const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
      const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (username && password) {
        const adminUser = await transaction.adminUser.upsert({
          where: { username },
          update: {
            displayName:
              process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || '超级管理员',
            isActive: true,
          },
          create: {
            username,
            passwordHash: await passwordService.hash(password),
            displayName:
              process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || '超级管理员',
          },
          select: { id: true },
        });
        const superAdminRole = roles.get('SUPER_ADMIN');
        if (!superAdminRole) throw new Error('Missing SUPER_ADMIN role');
        await transaction.adminUserRole.upsert({
          where: {
            adminUserId_roleId: {
              adminUserId: adminUser.id,
              roleId: superAdminRole.id,
            },
          },
          update: {},
          create: { adminUserId: adminUser.id, roleId: superAdminRole.id },
        });
      }
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
