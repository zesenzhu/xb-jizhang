import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminPermissionService } from '../common/admin-permission.service';
import type { AdminContext } from '../common/admin.types';
import { AdminLedgerService } from './admin-ledger.service';

describe('AdminLedgerService', () => {
  const updatedAt = new Date('2026-10-30T08:00:00.000Z');
  const operator: AdminContext = {
    id: 'admin-1',
    username: 'operator',
    displayName: '运营人员',
    roles: ['OPERATOR'],
    permissions: ['admin:ledger:read', 'admin:ledger:status'],
  };

  const createService = () => {
    const transactionClient = {
      ledger: { updateMany: jest.fn(), findUnique: jest.fn() },
    };
    const prisma = {
      ledger: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
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
      service: new AdminLedgerService(
        prisma as unknown as PrismaService,
        auditService as unknown as AdminAuditService,
        { requireAuditReason: (reason: string) => reason.trim() } as unknown as AdminPermissionService,
      ),
    };
  };

  it('给定账本查询条件，当管理员分页查询账本，则返回账本摘要和成员数量', async () => {
    const dependencies = createService();
    dependencies.prisma.ledger.findMany.mockResolvedValue([
      {
        id: 'ledger-1',
        name: '家庭账本',
        type: 'SHARED',
        defaultCurrency: 'CNY',
        isArchived: false,
        creator: { id: 'user-1', username: 'xiaobao', nickname: '小宝' },
        createdAt: updatedAt,
        updatedAt,
        _count: { members: 2, transactions: 10 },
      },
    ]);
    dependencies.prisma.ledger.count.mockResolvedValue(1);

    const result = await dependencies.service.list({ page: 1, pageSize: 20, status: 'ACTIVE' });

    expect(result).toEqual({
      items: [expect.objectContaining({ id: 'ledger-1', memberCount: 2, transactionCount: 10 })],
      total: 1,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
    });
  });

  it('给定账本版本匹配，当管理员归档账本，则更新状态并记录审计', async () => {
    const dependencies = createService();
    dependencies.prisma.ledger.findUnique.mockResolvedValue({
      id: 'ledger-1',
      name: '家庭账本',
      isArchived: false,
      updatedAt,
    });
    dependencies.transactionClient.ledger.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledger.findUnique.mockResolvedValue({
      id: 'ledger-1',
      name: '家庭账本',
      type: 'SHARED',
      defaultCurrency: 'CNY',
      isArchived: true,
      creator: { id: 'user-1', username: 'xiaobao', nickname: '小宝' },
      createdAt: updatedAt,
      updatedAt,
      _count: { members: 2, transactions: 10 },
    });

    await dependencies.service.updateStatus(
      'ledger-1',
      { status: 'ARCHIVED', reason: '用户申请归档', updatedAt },
      operator,
      { requestId: 'request-1' },
    );

    expect(dependencies.auditService.record).toHaveBeenCalledWith(
      dependencies.transactionClient,
      expect.objectContaining({ action: 'admin.ledger.status', result: 'SUCCESS' }),
    );
  });

  it('给定账本不存在，当管理员修改状态，则返回管理端资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledger.findUnique.mockResolvedValue(null);

    await expect(
      dependencies.service.updateStatus(
        'missing-ledger',
        { status: 'ARCHIVED', reason: '归档', updatedAt },
        operator,
        { requestId: 'request-1' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('给定账本版本不匹配，当管理员修改状态，则返回并发冲突', async () => {
    const dependencies = createService();
    dependencies.prisma.ledger.findUnique.mockResolvedValue({
      id: 'ledger-1',
      isArchived: false,
      updatedAt: new Date('2026-10-30T09:00:00.000Z'),
    });

    await expect(
      dependencies.service.updateStatus(
        'ledger-1',
        { status: 'ARCHIVED', reason: '归档', updatedAt },
        operator,
        { requestId: 'request-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
