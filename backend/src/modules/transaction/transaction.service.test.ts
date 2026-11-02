import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';
  const accountId = 'account-1';
  const categoryId = 'category-1';
  const payerId = 'user-2';
  const transactionId = 'transaction-1';
  const occurredAt = new Date('2026-10-31T08:00:00.000Z');
  const account = {
    id: accountId,
    ledgerId,
    ownerId: null,
    name: '微信',
    visibility: 'SHARED' as const,
    isActive: true,
    currentBalanceCents: 10000,
  };
  const category = {
    id: categoryId,
    ledgerId,
    type: 'EXPENSE' as const,
    name: '餐饮',
    isActive: true,
  };
  const transaction = {
    id: transactionId,
    ledgerId,
    type: 'EXPENSE' as const,
    amountCents: 3500,
    occurredAt,
    title: '早餐',
    note: null,
    categoryId,
    accountId,
    fromAccountId: null,
    toAccountId: null,
    transferGroupId: null,
    source: 'MANUAL' as const,
    clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
    createdById: userId,
    updatedById: userId,
    payerId,
    version: 1,
    deletedAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    category,
    account,
    payer: { id: payerId, nickname: '小宝' },
  };

  const createService = () => {
    const transactionClient = {
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      account: { updateMany: jest.fn() },
      transactionAuditLog: { create: jest.fn() },
    };
    const prisma = {
      ledgerMember: { findUnique: jest.fn() },
      account: { findFirst: jest.fn() },
      category: { findFirst: jest.fn() },
      transaction: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient),
      ),
    };

    return {
      prisma,
      transactionClient,
      service: new TransactionService(prisma as unknown as PrismaService),
    };
  };

  const validInput = {
    clientRequestId: transaction.clientRequestId,
    type: 'EXPENSE' as const,
    amountCents: 3500,
    occurredAt: occurredAt.toISOString(),
    categoryId,
    accountId,
    payerId,
    title: '早餐',
    note: null,
  };

  it('给定 Editor 提交有效支出，当账户分类付款人均属于当前账本，则创建账单并扣减余额写入审计', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique
      .mockResolvedValueOnce({ role: 'EDITOR', status: 'ACTIVE' })
      .mockResolvedValueOnce({ role: 'ACTIVE', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(null);
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.create.mockResolvedValue(transaction);
    dependencies.transactionClient.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-1' });
    dependencies.prisma.transaction.findUnique.mockResolvedValue(transaction);

    const result = await dependencies.service.create(userId, ledgerId, validInput);

    expect(dependencies.transactionClient.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ledgerId,
          type: 'EXPENSE',
          amountCents: 3500,
          accountId,
          categoryId,
          createdById: userId,
          updatedById: userId,
          payerId,
        }),
      }),
    );
    expect(dependencies.transactionClient.account.updateMany).toHaveBeenCalledWith({
      where: { id: accountId, ledgerId, isActive: true },
      data: { currentBalanceCents: { decrement: 3500 } },
    });
    expect(dependencies.transactionClient.transactionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ledgerId, transactionId, operatorId: userId, action: 'CREATE' }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: transactionId, amountCents: 3500 }));
  });

  it('给定 Viewer 提交账单，当执行创建，则拒绝写入且不启动事务', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    await expect(dependencies.service.create(userId, ledgerId, validInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定金额不是正整数，当提交账单，则返回参数错误且余额不变', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });

    await expect(
      dependencies.service.create(userId, ledgerId, { ...validInput, amountCents: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定分类类型与账单类型不匹配，当提交账单，则返回资源错误且不更新余额', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(null);
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue({ ...category, type: 'INCOME' });

    await expect(dependencies.service.create(userId, ledgerId, validInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定同一账本的幂等请求已创建，当再次提交，则返回原账单且不重复更新余额和审计', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(transaction);
    dependencies.prisma.transaction.findUnique.mockResolvedValue(transaction);

    const result = await dependencies.service.create(userId, ledgerId, validInput);

    expect(result).toEqual(expect.objectContaining({ id: transactionId }));
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.account.updateMany).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.transactionAuditLog.create).not.toHaveBeenCalled();
  });

  it('给定账单关联其他账本账户，当用户提交，则返回资源不存在且不暴露详情', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(null);
    dependencies.prisma.account.findFirst.mockResolvedValue(null);

    await expect(dependencies.service.create(userId, ledgerId, validInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dependencies.prisma.category.findFirst).not.toHaveBeenCalled();
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定账单已创建，当查询详情，则重新读取并返回账单关联摘要', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(transaction);

    const result = await dependencies.service.getDetail(userId, ledgerId, transactionId);

    expect(dependencies.prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: transactionId, ledgerId, deletedAt: null } }),
    );
    expect(result).toEqual(expect.objectContaining({ id: transactionId, category, account }));
  });

  it('给定账单不存在或不属于当前账本，当查询详情，则返回资源不存在', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(dependencies.service.getDetail(userId, ledgerId, transactionId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('给定私人账户已停用但账单保留，当账户所有者查询详情，则仍返回历史账单', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue({
      ...transaction,
      account: { ...account, ownerId: userId, visibility: 'PRIVATE' },
    });
    dependencies.prisma.account.findFirst.mockResolvedValue({ id: accountId });

    const result = await dependencies.service.getDetail(userId, ledgerId, transactionId);

    expect(dependencies.prisma.account.findFirst).toHaveBeenCalledWith({
      where: { id: accountId, ledgerId, ownerId: userId },
      select: { id: true },
    });
    expect(result).toEqual(expect.objectContaining({ id: transactionId }));
  });

  it('给定幂等唯一键发生并发冲突，当数据库返回重复错误，则回读原账单', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(transaction);
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.create.mockRejectedValue({ code: 'P2002' });

    const result = await dependencies.service.create(userId, ledgerId, validInput);

    expect(result).toEqual(expect.objectContaining({ id: transactionId }));
    expect(dependencies.transactionClient.account.updateMany).not.toHaveBeenCalled();
  });

  it('给定活跃成员查询账单，当包含筛选条件，则按账本、可见账户和时间倒序分页返回', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findMany.mockResolvedValue([transaction]);
    dependencies.prisma.transaction.count.mockResolvedValue(1);

    const result = await dependencies.service.list(userId, ledgerId, {
      page: 2,
      pageSize: 10,
      type: 'EXPENSE',
      categoryId,
      accountId,
      payerId,
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      keyword: ' 早餐 ',
    });

    expect(dependencies.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ledgerId,
          deletedAt: null,
          type: 'EXPENSE',
          categoryId,
          accountId,
          payerId,
          occurredAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lt: new Date('2026-11-01T00:00:00.000Z'),
          },
          account: {
            OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }],
          },
          OR: [{ title: { contains: '早餐', mode: 'insensitive' } }, { note: { contains: '早餐', mode: 'insensitive' } }],
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: 10,
        take: 10,
        select: expect.any(Object),
      }),
    );
    expect(result).toEqual({
      items: [transaction],
      total: 1,
      page: 2,
      pageSize: 10,
      hasNextPage: false,
    });
  });

  it('给定没有账单，当成员查询列表，则返回空分页结果', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findMany.mockResolvedValue([]);
    dependencies.prisma.transaction.count.mockResolvedValue(0);

    const result = await dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
    });

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20, hasNextPage: false });
  });

  it('给定时间范围无效，当查询账单列表，则返回参数错误且不查询数据库', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      dependencies.service.list(userId, ledgerId, {
        page: 1,
        pageSize: 20,
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('给定数据库返回非幂等冲突，当创建账单，则保留冲突异常', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(null);
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.create.mockRejectedValue({ code: 'P2002' });
    dependencies.prisma.transaction.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(dependencies.service.create(userId, ledgerId, validInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
