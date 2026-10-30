import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import type { AdminContext } from '../common/admin.types';
import { AdminUserService } from './admin-user.service';

describe('AdminUserService', () => {
  const updatedAt = new Date('2026-10-30T08:00:00.000Z');
  const operator: AdminContext = {
    id: 'admin-1',
    username: 'root',
    displayName: '超级管理员',
    roles: ['SUPER_ADMIN'],
    permissions: ['admin:admin_user:manage'],
  };

  const createService = () => {
    const transactionClient = {
      adminUser: { updateMany: jest.fn(), findUnique: jest.fn() },
      adminRole: { findMany: jest.fn() },
      adminUserRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      adminRefreshSession: { updateMany: jest.fn() },
    };
    const prisma = {
      adminUser: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      adminRole: { findMany: jest.fn() },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const auditService = { record: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    return {
      prisma,
      transactionClient,
      auditService,
      service: new AdminUserService(
        prisma as unknown as PrismaService,
        auditService as unknown as AdminAuditService,
        { requireAuditReason: (reason: string) => reason.trim() } as unknown as AdminPermissionService,
      ),
    };
  };

  it('给定管理员列表查询，当请求管理员账号，则返回角色摘要且不返回密码哈希', async () => {
    const dependencies = createService();
    dependencies.prisma.adminUser.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        username: 'root',
        displayName: '超级管理员',
        isActive: true,
        lastLoginAt: updatedAt,
        createdAt: updatedAt,
        updatedAt,
        roles: [{ role: { code: 'SUPER_ADMIN' } }],
      },
    ]);
    dependencies.prisma.adminUser.count.mockResolvedValue(1);

    const result = await dependencies.service.list({ page: 1, pageSize: 20 });

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'admin-1', roles: ['SUPER_ADMIN'] }),
    );
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('给定管理员角色和状态有效，当超级管理员更新运营账号，则修改角色并撤销目标会话', async () => {
    const dependencies = createService();
    dependencies.prisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-2',
      username: 'operator',
      displayName: '运营人员',
      isActive: true,
      updatedAt,
      roles: [{ role: { code: 'OPERATOR' } }],
    });
    dependencies.transactionClient.adminRole.findMany.mockResolvedValue([
      { id: 'role-auditor', code: 'AUDITOR' },
    ]);
    dependencies.transactionClient.adminUser.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.adminUser.findUnique.mockResolvedValue({
      id: 'admin-2',
      username: 'operator',
      displayName: '运营人员',
      isActive: false,
      lastLoginAt: null,
      createdAt: updatedAt,
      updatedAt,
      roles: [{ role: { code: 'AUDITOR' } }],
    });

    await dependencies.service.update(
      'admin-2',
      {
        isActive: false,
        roleCodes: ['AUDITOR'],
        reason: '调整职责',
        updatedAt,
      },
      operator,
      { requestId: 'request-1' },
    );

    expect(dependencies.transactionClient.adminUserRole.createMany).toHaveBeenCalledWith({
      data: [{ adminUserId: 'admin-2', roleId: 'role-auditor' }],
    });
    expect(dependencies.transactionClient.adminRefreshSession.updateMany).toHaveBeenCalled();
    expect(dependencies.auditService.record).toHaveBeenCalledWith(
      dependencies.transactionClient,
      expect.objectContaining({ action: 'admin.admin_user.update', result: 'SUCCESS' }),
    );
  });

  it('给定目标是最后一个超级管理员，当尝试停用，则拒绝操作', async () => {
    const dependencies = createService();
    dependencies.prisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'root',
      displayName: '超级管理员',
      isActive: true,
      updatedAt,
      roles: [{ role: { code: 'SUPER_ADMIN' } }],
    });
    dependencies.prisma.adminUser.count.mockResolvedValue(1);

    await expect(
      dependencies.service.update(
        'admin-1',
        { isActive: false, reason: '停用', updatedAt },
        operator,
        { requestId: 'request-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
