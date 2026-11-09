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
    noteUpdatedAt: null,
    categoryId,
    accountId,
    fromAccountId: null,
    toAccountId: null,
    transferGroupId: null,
    source: 'MANUAL' as const,
    clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
    createdById: userId,
    createdBy: { id: userId, username: 'xiaobao', nickname: '小宝', avatar: null },
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
        updateMany: jest.fn(),
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
      $queryRaw: jest.fn(),
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
    dependencies.prisma.transaction.findFirst.mockResolvedValueOnce(null).mockResolvedValue(transaction);
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

  it('给定有效账单，当事务提交后返回创建结果，则事务内不读取关联详情', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(transaction);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.create.mockResolvedValue(transaction);
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-1' });

    await dependencies.service.create(userId, ledgerId, { ...validInput, accountId: undefined });

    const createArgs = dependencies.transactionClient.transaction.create.mock.calls[0][0];
    expect(createArgs.select).not.toHaveProperty('createdBy');
    expect(createArgs.select).not.toHaveProperty('category');
    expect(createArgs.select).not.toHaveProperty('account');
    expect(createArgs.select).not.toHaveProperty('payer');
    expect(dependencies.prisma.transaction.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: transactionId, ledgerId, deletedAt: null },
      select: expect.objectContaining({ createdBy: expect.any(Object), category: expect.any(Object) }),
    });
  });

  it('给定收入或支出未选择账户，当其他字段有效，则创建账单且不更新账户余额', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ ...transaction, accountId: null, account: null });
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.create.mockResolvedValue({
      ...transaction,
      accountId: null,
      account: null,
    });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await dependencies.service.create(userId, ledgerId, {
      ...validInput,
      accountId: undefined,
    });

    expect(dependencies.prisma.account.findFirst).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accountId: null }) }),
    );
    expect(dependencies.transactionClient.account.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: transactionId, accountId: null }));
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
    expect(result).toEqual(
      expect.objectContaining({
        id: transactionId,
        category,
        account,
        createdBy: expect.objectContaining({ id: userId, username: 'xiaobao', nickname: '小宝' }),
      }),
    );
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

  it('给定有效一级分类，当按分类根节点查询账单，则匹配根分类直记和二级分类账单', async () => {
    const dependencies = createService();
    const categoryRootId = '11111111-1111-4111-8111-111111111111';
    const childCategoryId = '22222222-2222-4222-8222-222222222222';
    const directTransaction = {
      ...transaction,
      id: 'transaction-root',
      category: { ...category, id: categoryRootId, parentId: null },
    };
    const childTransaction = {
      ...transaction,
      id: 'transaction-child',
      category: { ...category, id: childCategoryId, parentId: categoryRootId },
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.category.findFirst.mockResolvedValue({ id: categoryRootId, parentId: null });
    dependencies.prisma.transaction.findMany.mockResolvedValue([directTransaction, childTransaction]);
    dependencies.prisma.transaction.count.mockResolvedValue(2);

    const query: Parameters<TransactionService['list']>[2] & { categoryRootId: string } = {
      page: 1,
      pageSize: 20,
      categoryRootId,
    };
    const result = await dependencies.service.list(userId, ledgerId, query);

    expect(dependencies.prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: categoryRootId, ledgerId },
      select: { id: true, parentId: true },
    });
    expect(dependencies.prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ledgerId,
        deletedAt: null,
        OR: [
          { categoryId: categoryRootId },
          { category: { parentId: categoryRootId } },
        ],
      }),
    }));
    expect(result.items.map(({ id }) => id)).toEqual(['transaction-root', 'transaction-child']);
  });

  it('给定分类根节点属于其他账本，当查询分类下钻，则返回资源不存在且不查询账单', async () => {
    const dependencies = createService();
    const categoryRootId = '11111111-1111-4111-8111-111111111111';
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.category.findFirst.mockResolvedValue(null);
    dependencies.prisma.transaction.findMany.mockResolvedValue([]);
    dependencies.prisma.transaction.count.mockResolvedValue(0);

    await expect(dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      categoryRootId,
    } as Parameters<TransactionService['list']>[2] & { categoryRootId: string })).rejects.toMatchObject({
      response: { code: 40421 },
    });
    expect(dependencies.prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(dependencies.prisma.transaction.count).not.toHaveBeenCalled();
  });

  it('给定分类下钻 ID 指向二级分类，当查询账单列表，则返回根分类层级参数错误', async () => {
    const dependencies = createService();
    const categoryRootId = '22222222-2222-4222-8222-222222222222';
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.category.findFirst.mockResolvedValue({ id: categoryRootId, parentId: 'root-category' });
    dependencies.prisma.transaction.findMany.mockResolvedValue([]);
    dependencies.prisma.transaction.count.mockResolvedValue(0);

    await expect(dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      categoryRootId,
    } as Parameters<TransactionService['list']>[2] & { categoryRootId: string })).rejects.toMatchObject({
      response: { code: 40023 },
    });
    expect(dependencies.prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('给定精确分类和分类根节点同时传入，当查询账单列表，则返回筛选参数冲突', async () => {
    const dependencies = createService();
    const categoryRootId = '11111111-1111-4111-8111-111111111111';
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findMany.mockResolvedValue([]);
    dependencies.prisma.transaction.count.mockResolvedValue(0);

    await expect(dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      categoryId,
      categoryRootId,
    } as Parameters<TransactionService['list']>[2] & { categoryRootId: string })).rejects.toMatchObject({
      response: { code: 40023 },
    });
    expect(dependencies.prisma.category.findFirst).not.toHaveBeenCalled();
    expect(dependencies.prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('给定未分类筛选，当查询账单列表，则只传入空分类条件且不查询分类根节点', async () => {
    const dependencies = createService();
    const uncategorizedTransaction = {
      ...transaction,
      categoryId: null,
      category: null,
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findMany.mockResolvedValue([uncategorizedTransaction]);
    dependencies.prisma.transaction.count.mockResolvedValue(1);

    const result = await dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      uncategorized: true,
    });

    expect(dependencies.prisma.category.findFirst).not.toHaveBeenCalled();
    expect(dependencies.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: null }),
      }),
    );
    expect(result.items).toEqual([uncategorizedTransaction]);
  });

  it('给定未分类与具体分类同时传入，当查询账单列表，则返回筛选参数冲突', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });

    await expect(
      dependencies.service.list(userId, ledgerId, {
        page: 1,
        pageSize: 20,
        categoryId,
        uncategorized: true,
      }),
    ).rejects.toMatchObject({ response: { code: 40023 } });
    expect(dependencies.prisma.transaction.findMany).not.toHaveBeenCalled();
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
          AND: [
            {
              OR: [
                { accountId: null },
                { account: { OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }] } },
              ],
            },
            { OR: [{ title: { contains: '早餐', mode: 'insensitive' } }, { note: { contains: '早餐', mode: 'insensitive' } }] },
          ],
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

  it('给定账单未选择账户，当成员查询列表，则仍返回该账单', async () => {
    const dependencies = createService();
    const unaccountedTransaction = { ...transaction, accountId: null, account: null };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findMany.mockResolvedValue([unaccountedTransaction]);
    dependencies.prisma.transaction.count.mockResolvedValue(1);

    const result = await dependencies.service.list(userId, ledgerId, { page: 1, pageSize: 20 });

    expect(dependencies.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { accountId: null },
                { account: { OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }] } },
              ],
            },
          ],
        }),
      }),
    );
    expect(result.items).toEqual([unaccountedTransaction]);
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

  it('给定 Editor 编辑未删除账单，当版本和关联资源有效，则撤销旧余额并应用新余额后递增版本', async () => {
    const dependencies = createService();
    const updatedTransaction = {
      ...transaction,
      amountCents: 4000,
      title: '早餐和咖啡',
      version: 2,
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(transaction)
      .mockResolvedValue(updatedTransaction);
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-2' });
    dependencies.transactionClient.transaction.findUnique.mockResolvedValue(updatedTransaction);

    const result = await dependencies.service.update(userId, ledgerId, transactionId, {
      version: 1,
      amountCents: 4000,
      title: '早餐和咖啡',
    });

    expect(dependencies.transactionClient.account.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: accountId, ledgerId },
      data: { currentBalanceCents: { increment: 3500 } },
    });
    expect(dependencies.transactionClient.account.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: accountId, ledgerId },
      data: { currentBalanceCents: { decrement: 4000 } },
    });
    expect(dependencies.transactionClient.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: transactionId, ledgerId, version: 1, deletedAt: null },
        data: expect.objectContaining({ amountCents: 4000, title: '早餐和咖啡', version: { increment: 1 } }),
      }),
    );
    expect(dependencies.transactionClient.transactionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'UPDATE' }) }),
    );
    expect(result).toEqual(expect.objectContaining({ amountCents: 4000, version: 2 }));
  });

  it('给定账单版本已过期，当成员编辑账单，则返回冲突且不更新余额', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(transaction);

    await expect(
      dependencies.service.update(userId, ledgerId, transactionId, { version: 2, amountCents: 4000 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
    expect(dependencies.prisma.account.findFirst).not.toHaveBeenCalled();
  });

  it('给定数据库遗留转账账单，当成员尝试编辑或删除，则拒绝一期不支持的类型且不启动事务', async () => {
    const dependencies = createService();
    const legacyTransfer = {
      ...transaction,
      type: 'TRANSFER' as const,
      category: null,
      account: null,
      fromAccountId: accountId,
      toAccountId: 'account-2',
      transferGroupId: 'transfer-group-1',
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(legacyTransfer);

    await expect(
      dependencies.service.update(userId, ledgerId, transactionId, { version: 1, amountCents: 4000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(dependencies.service.remove(userId, ledgerId, transactionId, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定账单切换为收入且取消账户，当成员编辑账单，则恢复旧支出余额且不应用新账户影响', async () => {
    const dependencies = createService();
    const incomeCategory = { ...category, type: 'INCOME' as const, name: '工资' };
    const updatedTransaction = {
      ...transaction,
      type: 'INCOME' as const,
      amountCents: 5000,
      categoryId: incomeCategory.id,
      accountId: null,
      account: null,
      version: 2,
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(transaction)
      .mockResolvedValue(updatedTransaction);
    dependencies.prisma.category.findFirst.mockResolvedValue(incomeCategory);
    dependencies.transactionClient.transaction.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-3' });
    dependencies.transactionClient.transaction.findUnique.mockResolvedValue(updatedTransaction);

    const result = await dependencies.service.update(userId, ledgerId, transactionId, {
      version: 1,
      type: 'INCOME',
      amountCents: 5000,
      categoryId: incomeCategory.id,
      accountId: null,
    });

    expect(dependencies.prisma.account.findFirst).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.account.updateMany).toHaveBeenCalledWith({
      where: { id: accountId, ledgerId },
      data: { currentBalanceCents: { increment: 3500 } },
    });
    expect(dependencies.transactionClient.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'INCOME', accountId: null }) }),
    );
    expect(result).toEqual(expect.objectContaining({ type: 'INCOME', accountId: null, version: 2 }));
  });

  it('给定 Owner 删除未删除账单，当版本正确，则软删除并恢复账户余额写入审计', async () => {
    const dependencies = createService();
    const deletedTransaction = { ...transaction, deletedAt: new Date('2026-11-01T08:00:00.000Z'), version: 2 };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(transaction)
      .mockResolvedValue(deletedTransaction);
    dependencies.transactionClient.transaction.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-4' });
    dependencies.transactionClient.transaction.findUnique.mockResolvedValue(deletedTransaction);

    const result = await dependencies.service.remove(userId, ledgerId, transactionId, 1);

    expect(dependencies.transactionClient.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: transactionId, ledgerId, version: 1, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), version: { increment: 1 } }),
      }),
    );
    expect(dependencies.transactionClient.account.updateMany).toHaveBeenCalledWith({
      where: { id: accountId, ledgerId },
      data: { currentBalanceCents: { increment: 3500 } },
    });
    expect(dependencies.transactionClient.transactionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'DELETE' }) }),
    );
    expect(result).toEqual(expect.objectContaining({ deletedAt: deletedTransaction.deletedAt, version: 2 }));
  });

  it('给定 Editor 删除他人创建的账单，当执行删除，则拒绝且不启动事务', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue({ ...transaction, createdById: 'other-user' });

    await expect(dependencies.service.remove(userId, ledgerId, transactionId, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定账单已软删除且操作者有权限，当重复删除，则返回原结果且不重复恢复余额', async () => {
    const dependencies = createService();
    const deletedTransaction = { ...transaction, deletedAt: new Date('2026-11-01T08:00:00.000Z'), version: 2 };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(deletedTransaction);

    const result = await dependencies.service.remove(userId, ledgerId, transactionId, 2);

    expect(result).toEqual(deletedTransaction);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定账单已软删除但 Editor 不是创建人，当重复删除，则仍拒绝越权访问', async () => {
    const dependencies = createService();
    const deletedTransaction = {
      ...transaction,
      createdById: 'other-user',
      deletedAt: new Date('2026-11-01T08:00:00.000Z'),
      version: 2,
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValue(deletedTransaction);

    await expect(dependencies.service.remove(userId, ledgerId, transactionId, 2)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定备注非空，当创建账单，则写入 noteUpdatedAt；编辑备注变化时更新时间，未变化时保留', async () => {
    const dependencies = createService();
    const noted = {
      ...transaction,
      note: '午餐',
      noteUpdatedAt: new Date('2026-11-08T08:00:00.000Z'),
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst.mockResolvedValueOnce(null).mockResolvedValue(noted);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.transaction.create.mockResolvedValue(noted);
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-note' });
    dependencies.prisma.transaction.findUnique.mockResolvedValue(noted);

    await dependencies.service.create(userId, ledgerId, {
      ...validInput,
      accountId: undefined,
      note: ' 午餐 ',
    });

    expect(dependencies.transactionClient.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: '午餐',
          noteUpdatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('给定备注未变化，当编辑金额，则保留原 noteUpdatedAt', async () => {
    const dependencies = createService();
    const noted = {
      ...transaction,
      note: '午餐',
      noteUpdatedAt: new Date('2026-11-01T08:00:00.000Z'),
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(noted)
      .mockResolvedValue({ ...noted, amountCents: 4000, version: 2 });
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transaction.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-note-2' });
    dependencies.transactionClient.transaction.findUnique.mockResolvedValue({ ...noted, amountCents: 4000, version: 2 });

    await dependencies.service.update(userId, ledgerId, transactionId, {
      version: 1,
      amountCents: 4000,
    });

    expect(dependencies.transactionClient.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: '午餐',
          noteUpdatedAt: noted.noteUpdatedAt,
        }),
      }),
    );
  });

  it('给定备注变更，当编辑账单，则更新 noteUpdatedAt', async () => {
    const dependencies = createService();
    const noted = {
      ...transaction,
      note: '午餐',
      noteUpdatedAt: new Date('2026-11-01T08:00:00.000Z'),
    };
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });
    dependencies.prisma.transaction.findFirst
      .mockResolvedValueOnce(noted)
      .mockResolvedValue({ ...noted, note: '晚餐', version: 2 });
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.category.findFirst.mockResolvedValue(category);
    dependencies.transactionClient.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transaction.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.transactionAuditLog.create.mockResolvedValue({ id: 'audit-note-3' });
    dependencies.transactionClient.transaction.findUnique.mockResolvedValue({ ...noted, note: '晚餐', version: 2 });

    await dependencies.service.update(userId, ledgerId, transactionId, {
      version: 1,
      note: '晚餐',
    });

    expect(dependencies.transactionClient.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: '晚餐',
          noteUpdatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('给定活跃成员查询备注候选，当账本内有历史备注，则返回去重后的服务端结果', async () => {
    const dependencies = createService();
    const rows = [{ text: '午餐', lastUsedAt: new Date('2026-11-08T08:00:00.000Z') }];
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'VIEWER', status: 'ACTIVE' });
    dependencies.prisma.$queryRaw.mockResolvedValue(rows);

    const result = await dependencies.service.getNoteSuggestions(userId, ledgerId, 10);

    expect(result).toEqual({ items: rows });
    expect(dependencies.prisma.$queryRaw).toHaveBeenCalled();
  });

  it('给定无时区偏移的时间，当创建账单，则返回参数错误且不写数据库', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });

    await expect(
      dependencies.service.create(userId, ledgerId, {
        ...validInput,
        occurredAt: '2026-11-08T20:30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });
});
