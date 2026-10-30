import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import type { AdminContext } from '../common/admin.types';
import { AdminUserManagementService } from './admin-user-management.service';

describe('AdminUserManagementService', () => {
  const updatedAt = new Date('2026-10-30T08:00:00.000Z');
  const adminUser: AdminContext = {
    id: 'admin-1',
    username: 'operator',
    displayName: '运营人员',
    roles: ['OPERATOR'],
    permissions: ['admin:user:read', 'admin:user:status'],
  };

  const createService = () => {
    const transactionClient = {
      user: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      refreshSession: { updateMany: jest.fn() },
      adminAuditLog: { create: jest.fn() },
    };
    const prisma = {
      user: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    return {
      prisma,
      transactionClient,
      auditService,
      service: new AdminUserManagementService(
        prisma as unknown as PrismaService,
        auditService as unknown as AdminAuditService,
        { requireAuditReason: (reason: string) => reason.trim() } as unknown as AdminPermissionService,
      ),
    };
  };

  it('给定用户查询条件，当管理员分页查询用户，则只返回脱敏资料和分页信息', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        username: 'xiaobao',
        nickname: '小宝',
        email: 'xiaobao@example.com',
        isActive: true,
        createdAt: updatedAt,
        updatedAt,
        _count: { ledgerMemberships: 2 },
      },
    ]);
    dependencies.prisma.user.count.mockResolvedValue(1);

    const result = await dependencies.service.list({ page: 1, pageSize: 20, keyword: 'xiao' });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'user-1',
          email: 'x***@example.com',
          ledgerCount: 2,
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
    });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('给定用户存在且版本匹配，当管理员禁用用户，则撤销普通会话并写入成功审计', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'xiaobao',
      isActive: true,
      updatedAt,
      nickname: '小宝',
      email: 'xiaobao@example.com',
    });
    dependencies.transactionClient.user.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'xiaobao',
      nickname: '小宝',
      email: 'xiaobao@example.com',
      isActive: false,
      createdAt: updatedAt,
      updatedAt,
      _count: { ledgerMemberships: 2 },
    });

    await dependencies.service.updateStatus(
      'user-1',
      { status: 'INACTIVE', reason: '处理申诉', updatedAt },
      adminUser,
      { requestId: 'request-1', ip: '127.0.0.1', userAgent: 'test-agent' },
    );

    expect(dependencies.transactionClient.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
    );
    expect(dependencies.auditService.record).toHaveBeenCalledWith(
      dependencies.transactionClient,
      expect.objectContaining({ action: 'admin.user.status', result: 'SUCCESS' }),
    );
  });

  it('给定用户版本已经变化，当管理员更新状态，则返回并发冲突且不写审计', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      updatedAt: new Date('2026-10-30T09:00:00.000Z'),
    });

    await expect(
      dependencies.service.updateStatus(
        'user-1',
        { status: 'INACTIVE', reason: '处理申诉', updatedAt },
        adminUser,
        { requestId: 'request-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dependencies.auditService.record).not.toHaveBeenCalled();
  });

  it('给定用户不存在，当管理员查询状态，则返回管理端资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      dependencies.service.updateStatus(
        'missing-user',
        { status: 'ACTIVE', reason: '恢复账号', updatedAt },
        adminUser,
        { requestId: 'request-1' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
