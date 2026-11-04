import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLedgerInput, UpdateLedgerInput } from './ledger.types';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  const userId = 'user-1';
  const updatedAt = new Date('2026-10-30T08:00:00.000Z');

  const ledger = {
    id: 'ledger-1',
    name: '家庭账本',
    type: 'SHARED' as const,
    defaultCurrency: 'CNY',
    timezone: 'Asia/Shanghai',
    icon: null,
    color: null,
    isArchived: false,
    creatorId: userId,
    createdAt: updatedAt,
    updatedAt,
    _count: { members: 2 },
  };

  const createService = () => {
    const transactionClient = {
      ledger: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      ledgerMember: { create: jest.fn(), findUnique: jest.fn() },
      category: { createMany: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      ledgerCopyRequest: { create: jest.fn(), update: jest.fn() },
      transaction: { count: jest.fn(), create: jest.fn() },
      account: { create: jest.fn() },
      ledgerInvitation: { create: jest.fn() },
      transactionAuditLog: { create: jest.fn() },
      userLedgerPreference: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      ledger: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      ledgerMember: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      userLedgerPreference: { findUnique: jest.fn() },
      ledgerCopyRequest: { findUnique: jest.fn() },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    return {
      prisma,
      transactionClient,
      service: new LedgerService(prisma as unknown as PrismaService),
    };
  };

  it('给定用户拥有多个活跃账本，当查询账本列表，则只按成员关系返回账本角色', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findMany = jest.fn().mockResolvedValue([
      { role: 'OWNER', joinedAt: updatedAt, ledger },
    ]);
    dependencies.prisma.ledgerMember.count = jest.fn().mockResolvedValue(1);

    const result = await dependencies.service.list(userId, { page: 1, pageSize: 20 });

    expect(dependencies.prisma.ledgerMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: 'ACTIVE' },
      }),
    );
    expect(result).toEqual({
      items: [expect.objectContaining({ id: 'ledger-1', memberRole: 'OWNER' })],
      total: 1,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
    });
  });

  it('给定历史归档账本及非活跃成员，当查询列表，则仅按活跃成员关系返回归档账本和活跃人数', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findMany.mockResolvedValue([
      { role: 'OWNER', joinedAt: updatedAt, ledger: { ...ledger, isArchived: true } },
    ]);
    dependencies.prisma.ledgerMember.count.mockResolvedValue(1);
    dependencies.prisma.userLedgerPreference.findUnique.mockResolvedValue({
      currentLedgerId: 'ledger-1', defaultLedgerId: 'ledger-1',
    });

    const result = await dependencies.service.list(userId, { page: 1, pageSize: 20, includeArchived: false });

    expect(dependencies.prisma.ledgerMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, status: 'ACTIVE' },
      select: expect.objectContaining({ ledger: { select: expect.objectContaining({
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      }) } }),
    }));
    expect(result.items[0]).toEqual(expect.objectContaining({
      isArchived: true, memberCount: 2, isCurrent: true, isDefault: true,
    }));
  });

  it('给定偏好指向非列表账本，当查询列表，则不把偏好当作授权', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findMany.mockResolvedValue([{ role: 'OWNER', joinedAt: updatedAt, ledger }]);
    dependencies.prisma.ledgerMember.count.mockResolvedValue(1);
    dependencies.prisma.userLedgerPreference.findUnique.mockResolvedValue({
      currentLedgerId: 'other-ledger', defaultLedgerId: 'other-ledger',
    });

    const result = await dependencies.service.list(userId, { page: 1, pageSize: 20, includeArchived: true });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({ isCurrent: false, isDefault: false }));
  });

  it('给定合法账本信息，当用户创建账本，则在同一事务写入账本和 Owner 成员关系', async () => {
    const dependencies = createService();
    dependencies.transactionClient.ledger.create.mockResolvedValue(ledger);
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({
      id: 'member-1',
      role: 'OWNER',
      joinedAt: updatedAt,
    });
    dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });

    const result = await dependencies.service.create(userId, {
      name: ' 家庭账本 ',
      type: 'SHARED',
      defaultCurrency: 'CNY',
    });

    expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: '家庭账本',
          type: 'SHARED',
          defaultCurrency: 'CNY',
          timezone: 'Asia/Shanghai',
          creatorId: userId,
        },
      }),
    );
    expect(dependencies.transactionClient.ledgerMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ledgerId: 'ledger-1', userId, role: 'OWNER', status: 'ACTIVE' },
      }),
    );
    expect(dependencies.transactionClient.category.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ ledgerId: 'ledger-1', type: 'EXPENSE', isSystem: true }),
          expect.objectContaining({ ledgerId: 'ledger-1', type: 'INCOME', isSystem: true }),
        ]),
      }),
    );
    const defaultCategories = dependencies.transactionClient.category.createMany.mock.calls[0][0].data;
    expect(defaultCategories).toHaveLength(65);
    expect(defaultCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '餐饮', parentId: null }),
        expect.objectContaining({ name: '早餐', parentId: expect.any(String) }),
      ]),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'ledger-1', memberRole: 'OWNER', memberCount: 1 }));
  });

  it('给定有效 IANA 时区，当用户创建账本，则保存指定时区', async () => {
    const dependencies = createService();
    dependencies.transactionClient.ledger.create.mockResolvedValue(ledger);
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({
      id: 'member-1',
      role: 'OWNER',
      joinedAt: updatedAt,
    });
    dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });

    await dependencies.service.create(
      userId,
      {
        name: '纽约账本',
        type: 'PERSONAL',
        timezone: 'America/New_York',
      } as CreateLedgerInput,
    );

    expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timezone: 'America/New_York' }),
      }),
    );
  });

  it('给定 IANA Etc 时区，当用户创建账本，则接受其标识', async () => {
    const dependencies = createService();
    dependencies.transactionClient.ledger.create.mockResolvedValue(ledger);
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({ role: 'OWNER', joinedAt: updatedAt });
    dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });

    await dependencies.service.create(userId, {
      name: '海外账本', type: 'PERSONAL', timezone: 'Etc/GMT+8',
    } as CreateLedgerInput);

    expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ timezone: 'Etc/GMT+8' }),
    }));
  });

  it('给定 ICU 短名 CST，当用户创建账本，则在写入前拒绝', async () => {
    const dependencies = createService();
    dependencies.transactionClient.ledger.create.mockResolvedValue({ ...ledger, timezone: 'CST' });
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({ role: 'OWNER', joinedAt: updatedAt });
    dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });

    try {
      const result = await dependencies.service.create(userId, {
        name: '歧义时区账本', type: 'PERSONAL', timezone: 'CST',
      });
      expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timezone: 'CST' }),
      }));
      throw new Error(`CST 创建被错误写入，返回时区 ${result.timezone}`);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
    }
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['GMT', 'CET', 'EST5EDT', 'Etc/GMT+8'])(
    '给定合法 IANA 标识 %s，当创建账本，则写入原标识', async (timezone) => {
      const dependencies = createService();
      dependencies.transactionClient.ledger.create.mockResolvedValue({ ...ledger, timezone });
      dependencies.transactionClient.ledgerMember.create.mockResolvedValue({ role: 'OWNER', joinedAt: updatedAt });
      dependencies.transactionClient.category.createMany.mockResolvedValue({ count: 65 });

      const result = await dependencies.service.create(userId, { name: '时区账本', type: 'PERSONAL', timezone });

      expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timezone }),
      }));
      expect(result.timezone).toBe(timezone);
    },
  );

  it('给定不存在的 IANA 时区，当用户创建账本，则拒绝创建', async () => {
    const dependencies = createService();

    await expect(
      dependencies.service.create(
        userId,
        { name: '无效时区', type: 'PERSONAL', timezone: 'Mars/Olympus' } as CreateLedgerInput,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定 Owner 修改时区且账本没有账单，当更新资料，则保存新时区和币种', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue(ledger);
    dependencies.transactionClient.$queryRaw.mockResolvedValue([]);
    dependencies.transactionClient.transaction.count.mockResolvedValue(0);
    dependencies.transactionClient.ledger.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledger.findUnique.mockResolvedValue({
      ...ledger,
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
    });

    await dependencies.service.update(userId, 'ledger-1', {
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
      updatedAt,
    } as UpdateLedgerInput);

    expect(dependencies.transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(dependencies.transactionClient.transaction.count).toHaveBeenCalledWith({
      where: { ledgerId: 'ledger-1' },
    });
    expect(dependencies.transactionClient.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.transactionClient.transaction.count.mock.invocationCallOrder[0],
    );
    expect(dependencies.transactionClient.ledger.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defaultCurrency: 'USD',
          timezone: 'America/New_York',
        }),
      }),
    );
  });

  it('给定账本已有账单且包含软删除记录，当修改默认币种，则拒绝修改', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue(ledger);
    dependencies.transactionClient.$queryRaw.mockResolvedValue([]);
    dependencies.transactionClient.transaction.count.mockResolvedValue(1);

    await expect(
      dependencies.service.update(userId, 'ledger-1', {
        defaultCurrency: 'USD',
        updatedAt,
      } as UpdateLedgerInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dependencies.transactionClient.transaction.count).toHaveBeenCalledWith({
      where: { ledgerId: 'ledger-1' },
    });
    expect(dependencies.transactionClient.ledger.updateMany).not.toHaveBeenCalled();
  });

  it('给定非法时区，当 Owner 修改账本资料，则返回参数错误', async () => {
    const dependencies = createService();

    await expect(
      dependencies.service.update(userId, 'ledger-1', {
        timezone: 'Mars/Olympus',
        updatedAt,
      } as UpdateLedgerInput),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.ledgerMember.findUnique).not.toHaveBeenCalled();
  });

  it('给定 ICU 短名 CST，当 Owner 更新账本，则在读取成员前拒绝', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue(ledger);
    dependencies.transactionClient.ledger.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledger.findUnique.mockResolvedValue({ ...ledger, timezone: 'CST' });

    try {
      const result = await dependencies.service.update(userId, 'ledger-1', {
        timezone: 'CST', updatedAt,
      });
      expect(dependencies.transactionClient.ledger.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timezone: 'CST' }),
      }));
      throw new Error(`CST 更新被错误写入，返回时区 ${result.timezone}`);
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
    }
    expect(dependencies.prisma.ledgerMember.findUnique).not.toHaveBeenCalled();
  });

  it.each(['GMT', 'CET', 'EST5EDT', 'Etc/GMT+8'])(
    '给定合法 IANA 标识 %s，当 Owner 更新账本，则写入原标识', async (timezone) => {
      const dependencies = createService();
      dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
      dependencies.prisma.ledger.findUnique.mockResolvedValue(ledger);
      dependencies.transactionClient.ledger.updateMany.mockResolvedValue({ count: 1 });
      dependencies.transactionClient.ledger.findUnique.mockResolvedValue({ ...ledger, timezone });

      const result = await dependencies.service.update(userId, 'ledger-1', { timezone, updatedAt });

      expect(dependencies.transactionClient.ledger.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timezone }),
      }));
      expect(result.timezone).toBe(timezone);
    },
  );

  it('给定合法 Etc 时区，当 Owner 更新账本，则保存该时区', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue(ledger);
    dependencies.transactionClient.ledger.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledger.findUnique.mockResolvedValue({ ...ledger, timezone: 'Etc/GMT+8' });

    await dependencies.service.update(userId, 'ledger-1', { timezone: 'Etc/GMT+8', updatedAt });

    expect(dependencies.transactionClient.ledger.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ timezone: 'Etc/GMT+8' }),
    }));
  });

  it('给定不受支持的货币代码，当用户创建账本，则拒绝创建', async () => {
    const dependencies = createService();

    await expect(
      dependencies.service.create(
        userId,
        { name: '无效币种', type: 'PERSONAL', defaultCurrency: 'ZZZ' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定不受支持的货币代码，当 Owner 更新账本，则拒绝更新', async () => {
    const dependencies = createService();
    await expect(dependencies.service.update(userId, 'ledger-1', {
      defaultCurrency: 'ZZZ', updatedAt,
    } as UpdateLedgerInput)).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定归档字段，当普通用户更新账本，则不能写入归档状态', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue(ledger);
    dependencies.transactionClient.ledger.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledger.findUnique.mockResolvedValue(ledger);

    await dependencies.service.update(userId, 'ledger-1', {
      isArchived: true, updatedAt,
    } as UpdateLedgerInput);

    expect(dependencies.transactionClient.ledger.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ isArchived: expect.anything() }),
    }));
  });

  it('给定用户不是活跃成员，当读取账本详情，则返回资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue(null);

    await expect(dependencies.service.getDetail(userId, 'ledger-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(dependencies.prisma.ledgerMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ledgerId_userId: { ledgerId: 'ledger-1', userId } } }),
    );
  });

  it('给定 Editor 访问账本设置，当修改账本资料，则拒绝越权操作', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });

    await expect(
      dependencies.service.update(userId, 'ledger-1', {
        name: '新名称',
        updatedAt,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('给定 Owner 使用旧版本，当修改账本资料，则返回并发冲突且不覆盖新数据', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.ledger.findUnique.mockResolvedValue({ ...ledger, updatedAt: new Date('2026-10-30T09:00:00.000Z') });

    await expect(
      dependencies.service.update(userId, 'ledger-1', { name: '新名称', updatedAt }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  const copyInput = {
    name: ' 模板账本 ', type: 'PERSONAL' as const,
    clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
  };
  const sourceCategories = [
    { id: 'grandchild-1', ledgerId: 'ledger-1', type: 'EXPENSE', name: '粥', parentId: 'child-1',
      icon: null, color: null, sortOrder: 1, isSystem: false, isActive: true },
    { id: 'child-1', ledgerId: 'ledger-1', type: 'EXPENSE', name: '早餐', parentId: 'root-1',
      icon: null, color: null, sortOrder: 2, isSystem: false, isActive: false },
    { id: 'root-1', ledgerId: 'ledger-1', type: 'EXPENSE', name: '餐饮', parentId: null,
      icon: 'food', color: '#ffffff', sortOrder: 3, isSystem: true, isActive: true },
  ];

  it('给定非 Owner，当复制账本，则拒绝且不写入幂等记录', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE', ledger });
    const copy = dependencies.service as LedgerService & { copy: (userId: string, ledgerId: string, input: typeof copyInput) => Promise<unknown> };

    await expect(copy.copy(userId, ledger.id, copyInput)).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定分类树，当 Owner 复制账本，则同事务复制设置及完整分类关系且只创建一个 Owner', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerCopyRequest.findUnique.mockResolvedValue(null);
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE', ledger });
    dependencies.transactionClient.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE', ledger });
    dependencies.transactionClient.ledger.create.mockResolvedValue({ ...ledger, id: 'ledger-2', name: '模板账本', type: 'PERSONAL', _count: { members: 0 } });
    dependencies.transactionClient.ledgerMember.create.mockResolvedValue({ role: 'OWNER', joinedAt: updatedAt });
    dependencies.transactionClient.category.findMany.mockResolvedValue(sourceCategories);
    dependencies.transactionClient.category.create
      .mockResolvedValueOnce({ id: 'new-root' })
      .mockResolvedValueOnce({ id: 'new-child' })
      .mockResolvedValueOnce({ id: 'new-grandchild' });
    const copy = dependencies.service as LedgerService & { copy: (userId: string, ledgerId: string, input: typeof copyInput) => Promise<unknown> };

    const result = await copy.copy(userId, ledger.id, copyInput);

    expect(dependencies.transactionClient.ledgerCopyRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId, clientRequestId: copyInput.clientRequestId, sourceLedgerId: ledger.id }),
    }));
    expect(dependencies.transactionClient.ledger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: '模板账本', type: 'PERSONAL', defaultCurrency: 'CNY', timezone: 'Asia/Shanghai',
        icon: null, color: null, creatorId: userId },
    }));
    expect(dependencies.transactionClient.ledgerMember.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { ledgerId: 'ledger-2', userId, role: 'OWNER', status: 'ACTIVE' },
    }));
    expect(dependencies.transactionClient.category.create.mock.calls.map(([call]) => call.data)).toEqual([
      expect.objectContaining({ ledgerId: 'ledger-2', type: 'EXPENSE', name: '餐饮', parentId: null,
        icon: 'food', color: '#ffffff', sortOrder: 3, isSystem: true, isActive: true }),
      expect.objectContaining({ ledgerId: 'ledger-2', name: '早餐', parentId: 'new-root', isActive: false }),
      expect.objectContaining({ ledgerId: 'ledger-2', name: '粥', parentId: 'new-child' }),
    ]);
    expect(dependencies.transactionClient.ledgerCopyRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { targetLedgerId: 'ledger-2' },
    }));
    expect(dependencies.transactionClient.account.create).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.transaction.create).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.transaction.count).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.ledgerInvitation.create).not.toHaveBeenCalled();
    expect(dependencies.transactionClient.transactionAuditLog.create).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 'ledger-2', memberCount: 1, isCurrent: false, isDefault: false }));
  });

  it('给定已有幂等记录，当重试复制，则回读原目标而不创建新账本', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerCopyRequest.findUnique.mockResolvedValue({ sourceLedgerId: ledger.id, targetLedgerId: 'ledger-2' });
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE', joinedAt: updatedAt,
      ledger: { ...ledger, id: 'ledger-2' } });
    const copy = dependencies.service as LedgerService & { copy: (userId: string, ledgerId: string, input: typeof copyInput) => Promise<unknown> };

    expect(await copy.copy(userId, ledger.id, copyInput)).toEqual(expect.objectContaining({ id: 'ledger-2' }));
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定并发唯一键冲突，当另一个请求已完成，则回读其目标', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerCopyRequest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ sourceLedgerId: ledger.id, targetLedgerId: 'ledger-2' });
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE', joinedAt: updatedAt,
      ledger: { ...ledger, id: 'ledger-2' } });
    dependencies.prisma.$transaction.mockRejectedValue({ code: 'P2002' });
    const copy = dependencies.service as LedgerService & { copy: (userId: string, ledgerId: string, input: typeof copyInput) => Promise<unknown> };

    expect(await copy.copy(userId, ledger.id, copyInput)).toEqual(expect.objectContaining({ id: 'ledger-2' }));
  });

  it('给定已删目标的幂等记录，当重试复制，则冲突且不创建第二个账本', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerCopyRequest.findUnique.mockResolvedValue({ sourceLedgerId: ledger.id, targetLedgerId: null });
    const copy = dependencies.service as LedgerService & { copy: (userId: string, ledgerId: string, input: typeof copyInput) => Promise<unknown> };

    await expect(copy.copy(userId, ledger.id, copyInput)).rejects.toBeInstanceOf(ConflictException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });
});
