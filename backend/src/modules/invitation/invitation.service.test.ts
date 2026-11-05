import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  const ledgerId = 'ledger-1';
  const ownerId = 'user-owner';
  const invitedUserId = 'user-invited';
  const invitationId = 'invitation-1';
  const expiresAt = new Date('2026-11-02T08:00:00.000Z');

  const createService = () => {
    const transactionClient = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: ledgerId }]),
      ledgerInvitation: { update: jest.fn(), updateMany: jest.fn() },
      ledgerMember: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn() },
      ledger: { findUnique: jest.fn() },
      ledgerMember: { findUnique: jest.fn(), findMany: jest.fn() },
      ledgerInvitation: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    return {
      prisma,
      transactionClient,
      service: new InvitationService(prisma as unknown as PrismaService),
    };
  };

  it('给定 Owner 创建合法邀请，当提交带空格和大写的邮箱，则规范化邮箱并只在响应返回原始 Token', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.user.findUnique.mockResolvedValue(null);
    dependencies.prisma.ledgerInvitation.findFirst.mockResolvedValue(null);
    dependencies.prisma.ledgerInvitation.create.mockImplementation(async ({ data }) => ({
      id: invitationId,
      ledgerId,
      targetEmail: data.targetEmail,
      role: data.role,
      status: 'PENDING',
      expiresAt: data.expiresAt,
    }));

    const result = await dependencies.service.create(ownerId, ledgerId, {
      targetEmail: ' Member@Example.COM ',
      role: 'EDITOR',
    });

    expect(dependencies.prisma.ledgerInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetEmail: 'member@example.com',
          role: 'EDITOR',
          tokenHash: expect.not.stringMatching('one-time-token'),
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: invitationId, targetEmail: 'member@example.com' }));
    expect(result.inviteToken).toEqual(expect.any(String));
  });

  it('给定同一账本存在未过期邀请，当 Owner 再次邀请相同邮箱，则返回重复邀请冲突', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' });
    dependencies.prisma.user.findUnique.mockResolvedValue(null);
    dependencies.prisma.ledgerInvitation.findFirst.mockResolvedValue({
      id: invitationId,
      expiresAt: new Date(Date.now() + 60_000),
      status: 'PENDING',
    });

    await expect(
      dependencies.service.create(ownerId, ledgerId, {
        targetEmail: 'member@example.com',
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('给定个人账本 Owner，当创建邀请，则拒绝并返回个人账本业务冲突', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
      ledger: { type: 'PERSONAL' },
    });

    await expect(
      dependencies.service.create(ownerId, ledgerId, {
        targetEmail: 'member@example.com',
        role: 'EDITOR',
      }),
    ).rejects.toMatchObject({ response: { code: 40903 } });
    expect(dependencies.prisma.ledgerInvitation.create).not.toHaveBeenCalled();
  });

  it('给定共享账本存在过期和待处理邀请，当 Owner 查询，则先标记过期再返回待处理列表', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
      ledger: { type: 'SHARED' },
    });
    dependencies.prisma.ledgerInvitation.findMany.mockResolvedValue([
      {
        id: invitationId,
        ledgerId,
        targetEmail: 'member@example.com',
        role: 'EDITOR',
        status: 'PENDING',
        createdAt: new Date('2026-11-01T08:00:00.000Z'),
        expiresAt,
      },
    ]);

    const result = await dependencies.service.listForLedger(ownerId, ledgerId);

    expect(dependencies.prisma.ledgerInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ledgerId, status: 'PENDING', expiresAt: { lte: expect.any(Date) } }),
        data: { status: 'EXPIRED' },
      }),
    );
    expect(dependencies.prisma.ledgerInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ledgerId, status: 'PENDING' } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.inviteToken).toBeUndefined();
  });

  it('给定邀请邮箱与当前用户邮箱不一致，当用户接受邀请，则拒绝并不消费邀请', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue({ email: 'other@example.com' });
    dependencies.prisma.ledgerInvitation.findUnique.mockResolvedValue({
      id: invitationId,
      targetEmail: 'member@example.com',
      status: 'PENDING',
      expiresAt,
    });

    await expect(
      dependencies.service.accept(invitedUserId, 'invalid-for-test-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['LEFT', 'REMOVED'])('给定旧成员 %s 且邀请有效，当接受，则先锁账本再恢复成员并消费邀请', async (status) => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue({ email: 'member@example.com' });
    dependencies.prisma.ledgerInvitation.findUnique.mockResolvedValue({
      id: invitationId,
      ledgerId,
      targetEmail: 'member@example.com',
      role: 'VIEWER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      ledger: { id: ledgerId, name: '家庭账本', type: 'SHARED', defaultCurrency: 'CNY', icon: null, color: null, isArchived: false },
    });
    dependencies.transactionClient.ledgerMember.findUnique
      .mockResolvedValueOnce({
        id: 'member-old',
        status,
        role: 'EDITOR',
      })
      .mockResolvedValueOnce({ role: 'VIEWER', joinedAt: new Date() });
    dependencies.transactionClient.ledgerMember.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledgerInvitation.updateMany.mockResolvedValue({ count: 1 });

    const result = await dependencies.service.accept(invitedUserId, 'invite-token');

    expect(dependencies.transactionClient.ledgerMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE', role: 'VIEWER' } }),
    );
    expect(dependencies.transactionClient.ledgerInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
    );
    expect(result).toEqual(expect.objectContaining({ ledgerId, memberRole: 'VIEWER' }));
    const tx = dependencies.transactionClient;
    expect(tx.$queryRaw).toHaveBeenCalledWith(expect.objectContaining({
      text: 'SELECT id FROM "ledger" WHERE id = $1 FOR KEY SHARE', values: [ledgerId],
    }));
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.ledgerMember.findUnique.mock.invocationCallOrder[0]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.ledgerMember.updateMany.mock.invocationCallOrder[0]);
  });

  it('给定删除先完成，当接受邀请锁后账本不存在，则返回 404 且不读取或恢复成员、不消费邀请', async () => {
    const d = createService();
    d.prisma.user.findUnique.mockResolvedValue({ email: 'member@example.com' });
    d.prisma.ledgerInvitation.findUnique.mockResolvedValue({
      id: invitationId, ledgerId, targetEmail: 'member@example.com', role: 'VIEWER',
      status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
    });
    d.transactionClient.$queryRaw.mockResolvedValue([]);
    d.transactionClient.ledgerMember.findUnique.mockResolvedValue({ id: 'old', status: 'LEFT', role: 'VIEWER', joinedAt: new Date() });
    d.transactionClient.ledgerMember.updateMany.mockResolvedValue({ count: 1 });
    d.transactionClient.ledgerInvitation.updateMany.mockResolvedValue({ count: 1 });
    await expect(d.service.accept(invitedUserId, 'invite-token')).rejects.toBeInstanceOf(NotFoundException);
    expect(d.transactionClient.ledgerMember.findUnique).not.toHaveBeenCalled();
    expect(d.transactionClient.ledgerMember.updateMany).not.toHaveBeenCalled();
    expect(d.transactionClient.ledgerMember.create).not.toHaveBeenCalled();
    expect(d.transactionClient.ledgerInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('给定邀请已过期，当用户接受邀请，则返回冲突并标记邀请已过期', async () => {
    const dependencies = createService();
    dependencies.prisma.user.findUnique.mockResolvedValue({ email: 'member@example.com' });
    dependencies.prisma.ledgerInvitation.findUnique.mockResolvedValue({
      id: invitationId,
      targetEmail: 'member@example.com',
      status: 'PENDING',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    dependencies.prisma.ledgerInvitation.update.mockResolvedValue({});

    await expect(dependencies.service.accept(invitedUserId, 'invite-token')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(dependencies.prisma.ledgerInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
  });

  it('给定非 Owner 撤销邀请，当提交撤销请求，则拒绝操作', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({ role: 'EDITOR', status: 'ACTIVE' });

    await expect(
      dependencies.service.revoke('user-editor', ledgerId, invitationId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
