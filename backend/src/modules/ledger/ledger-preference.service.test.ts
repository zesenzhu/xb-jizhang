import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerPreferenceService } from './ledger-preference.service';

describe('LedgerPreferenceService', () => {
  const userId = 'user-1';
  const updatedAt = new Date('2026-11-04T08:00:00.000Z');

  const ledger = (id: string, name: string) => ({
    id,
    name,
    type: 'SHARED' as const,
    defaultCurrency: 'CNY',
    timezone: 'Asia/Shanghai',
  });

  const membership = (ledgerId: string, name: string) => ({
    ledgerId,
    role: 'OWNER' as const,
    joinedAt: updatedAt,
    ledger: ledger(ledgerId, name),
  });

  const createService = () => {
    const transactionClient = {
      userLedgerPreference: { findUnique: jest.fn(), upsert: jest.fn() },
      ledgerMember: { findMany: jest.fn(), findFirst: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };

    return {
      prisma,
      transactionClient,
      service: new LedgerPreferenceService(prisma as unknown as PrismaService),
    };
  };

  it('给定当前和默认账本仍可访问，当读取偏好，则返回账本安全摘要和成员角色', async () => {
    const dependencies = createService();
    dependencies.transactionClient.userLedgerPreference.findUnique.mockResolvedValue({
      currentLedgerId: 'ledger-1',
      defaultLedgerId: 'ledger-2',
      updatedAt,
    });
    dependencies.transactionClient.ledgerMember.findMany.mockResolvedValue([
      membership('ledger-1', '家庭账本'),
      membership('ledger-2', '旅行账本'),
    ]);
    dependencies.transactionClient.ledgerMember.findFirst.mockResolvedValue(
      membership('ledger-1', '家庭账本'),
    );

    const result = await dependencies.service.get(userId);

    expect(result).toEqual({
      currentLedgerId: 'ledger-1',
      defaultLedgerId: 'ledger-2',
      currentLedger: {
        ...ledger('ledger-1', '家庭账本'),
        memberRole: 'OWNER',
      },
      defaultLedger: {
        ...ledger('ledger-2', '旅行账本'),
        memberRole: 'OWNER',
      },
      updatedAt,
    });
    expect(dependencies.transactionClient.userLedgerPreference.upsert).not.toHaveBeenCalled();
  });

  it('给定保存的当前账本已无活跃成员关系，当读取偏好，则回退到最早账本并修复记录', async () => {
    const dependencies = createService();
    dependencies.transactionClient.userLedgerPreference.findUnique.mockResolvedValue({
      currentLedgerId: 'ledger-removed',
      defaultLedgerId: 'ledger-2',
      updatedAt,
    });
    dependencies.transactionClient.ledgerMember.findMany.mockResolvedValue([
      membership('ledger-2', '旅行账本'),
    ]);
    dependencies.transactionClient.ledgerMember.findFirst.mockResolvedValue(
      membership('ledger-1', '家庭账本'),
    );
    dependencies.transactionClient.userLedgerPreference.upsert.mockResolvedValue({
      updatedAt: new Date('2026-11-04T09:00:00.000Z'),
    });

    const result = await dependencies.service.get(userId);

    expect(dependencies.transactionClient.userLedgerPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        create: {
          userId,
          currentLedgerId: 'ledger-1',
          defaultLedgerId: 'ledger-2',
        },
        update: {
          currentLedgerId: 'ledger-1',
          defaultLedgerId: 'ledger-2',
        },
      }),
    );
    expect(result.currentLedgerId).toBe('ledger-1');
    expect(result.defaultLedgerId).toBe('ledger-2');
  });

  it('给定只切换当前账本，当更新偏好，则保留原默认账本', async () => {
    const dependencies = createService();
    dependencies.transactionClient.userLedgerPreference.findUnique.mockResolvedValue({
      currentLedgerId: 'ledger-1',
      defaultLedgerId: 'ledger-2',
      updatedAt,
    });
    dependencies.transactionClient.ledgerMember.findMany.mockResolvedValue([
      membership('ledger-1', '家庭账本'),
      membership('ledger-2', '旅行账本'),
      membership('ledger-3', '个人账本'),
    ]);
    dependencies.transactionClient.ledgerMember.findFirst.mockResolvedValue(
      membership('ledger-1', '家庭账本'),
    );
    dependencies.transactionClient.userLedgerPreference.upsert.mockResolvedValue({ updatedAt });

    await dependencies.service.update(userId, { currentLedgerId: 'ledger-3' });

    expect(dependencies.transactionClient.userLedgerPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { currentLedgerId: 'ledger-3', defaultLedgerId: 'ledger-2' },
      }),
    );
  });

  it('给定用户没有活跃账本，当读取偏好，则返回空账本引用', async () => {
    const dependencies = createService();
    dependencies.transactionClient.userLedgerPreference.findUnique.mockResolvedValue(null);
    dependencies.transactionClient.ledgerMember.findMany.mockResolvedValue([]);
    dependencies.transactionClient.ledgerMember.findFirst.mockResolvedValue(null);
    dependencies.transactionClient.userLedgerPreference.upsert.mockResolvedValue({ updatedAt });

    const result = await dependencies.service.get(userId);

    expect(result).toEqual({
      currentLedgerId: null,
      defaultLedgerId: null,
      currentLedger: null,
      defaultLedger: null,
      updatedAt,
    });
  });

  it('给定偏好更新请求没有提交字段，当更新偏好，则返回参数错误', async () => {
    const dependencies = createService();

    await expect(dependencies.service.update(userId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('给定目标账本不是当前用户的活跃成员，当更新偏好，则返回资源不存在且不写入', async () => {
    const dependencies = createService();
    dependencies.transactionClient.userLedgerPreference.findUnique.mockResolvedValue(null);
    dependencies.transactionClient.ledgerMember.findMany.mockResolvedValue([]);

    await expect(
      dependencies.service.update(userId, { currentLedgerId: 'ledger-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.transactionClient.userLedgerPreference.upsert).not.toHaveBeenCalled();
  });
});
