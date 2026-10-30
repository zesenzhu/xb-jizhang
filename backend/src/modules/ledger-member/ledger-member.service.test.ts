import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerMemberService } from './ledger-member.service';

describe('LedgerMemberService', () => {
  const ledgerId = 'ledger-1';
  const ownerUserId = 'user-owner';
  const editorUserId = 'user-editor';
  const ownerMemberId = 'member-owner';
  const editorMemberId = 'member-editor';

  const createService = () => {
    const transactionClient = {
      ledgerMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      ledgerMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    return {
      prisma,
      transactionClient,
      service: new LedgerMemberService(prisma as unknown as PrismaService),
    };
  };

  const activeOwner = { id: ownerMemberId, ledgerId, userId: ownerUserId, role: 'OWNER', status: 'ACTIVE' };
  const activeEditor = { id: editorMemberId, ledgerId, userId: editorUserId, role: 'EDITOR', status: 'ACTIVE' };

  it('给定 Viewer 是活跃成员，当查询成员列表，则只返回同一账本的活跃成员', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue(activeEditor);
    dependencies.prisma.ledgerMember.findMany.mockResolvedValue([
      { ...activeOwner, joinedAt: new Date(), user: { id: ownerUserId, username: 'owner', nickname: '负责人', avatar: null } },
      { ...activeEditor, joinedAt: new Date(), user: { id: editorUserId, username: 'editor', nickname: null, avatar: null } },
    ]);
    dependencies.prisma.ledgerMember.count.mockResolvedValue(2);

    const result = await dependencies.service.list(editorUserId, ledgerId);

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(dependencies.prisma.ledgerMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ledgerId, status: 'ACTIVE' }, skip: 0, take: 20 }),
    );
  });

  it('给定 Editor 不是 Owner，当修改成员角色，则拒绝操作', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue(activeEditor);

    await expect(
      dependencies.service.updateRole(editorUserId, ledgerId, ownerMemberId, 'VIEWER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('给定 Owner 修改同一账本的成员，当角色变更，则更新目标成员并返回最新摘要', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique
      .mockResolvedValueOnce(activeOwner)
      .mockResolvedValueOnce(activeEditor);
    dependencies.transactionClient.ledgerMember.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledgerMember.findUnique.mockResolvedValue({
      ...activeEditor,
      role: 'VIEWER',
      joinedAt: new Date(),
      user: { id: editorUserId, username: 'editor', nickname: null, avatar: null },
    });

    const result = await dependencies.service.updateRole(ownerUserId, ledgerId, editorMemberId, 'VIEWER');

    expect(dependencies.transactionClient.ledgerMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: editorMemberId, ledgerId, status: 'ACTIVE' },
        data: { role: 'VIEWER' },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: editorMemberId, role: 'VIEWER' }));
  });

  it('给定目标是最后一个 Owner，当移除或退出，则拒绝并保留成员状态', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue(activeOwner);
    dependencies.prisma.ledgerMember.count.mockResolvedValue(0);

    await expect(
      dependencies.service.remove(ownerUserId, ledgerId, ownerMemberId),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(dependencies.service.leave(ownerUserId, ledgerId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(dependencies.prisma.ledgerMember.updateMany).not.toHaveBeenCalled();
  });

  it('给定 Owner 转移给同一账本的活跃成员，当执行转移，则在一个事务内完成角色互换', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique
      .mockResolvedValueOnce(activeOwner)
      .mockResolvedValueOnce(activeEditor);
    dependencies.transactionClient.ledgerMember.updateMany.mockResolvedValue({ count: 1 });
    dependencies.transactionClient.ledgerMember.findMany.mockResolvedValue([
      { ...activeOwner, role: 'EDITOR', user: { id: ownerUserId, username: 'owner', nickname: null, avatar: null } },
      { ...activeEditor, role: 'OWNER', user: { id: editorUserId, username: 'editor', nickname: null, avatar: null } },
    ]);

    const result = await dependencies.service.transferOwnership(
      ownerUserId,
      ledgerId,
      editorMemberId,
    );

    expect(dependencies.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(dependencies.transactionClient.ledgerMember.updateMany).toHaveBeenCalledTimes(2);
    expect(result.newOwner).toEqual(expect.objectContaining({ id: editorMemberId, role: 'OWNER' }));
  });

  it('给定目标成员不属于当前账本，当 Owner 执行移除，则返回资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique
      .mockResolvedValueOnce(activeOwner)
      .mockResolvedValueOnce(null);

    await expect(
      dependencies.service.remove(ownerUserId, ledgerId, 'member-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
