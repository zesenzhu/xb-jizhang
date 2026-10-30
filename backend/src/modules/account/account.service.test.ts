import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';

describe('AccountService', () => {
  const userId = 'user-1';
  const ledgerId = 'ledger-1';
  const account = {
    id: 'account-1',
    ledgerId,
    ownerId: null,
    name: '微信',
    type: 'WECHAT',
    visibility: 'SHARED',
    initialBalanceCents: 0,
    currentBalanceCents: 12000,
    includeInAssets: true,
    icon: null,
    color: null,
    isActive: true,
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z'),
  };

  const createService = () => {
    const prisma = {
      account: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      ledgerMember: { findUnique: jest.fn() },
    };

    return {
      prisma,
      service: new AccountService(prisma as unknown as PrismaService),
    };
  };

  it('给定活跃成员，当查询账户，则只读取当前账本中对用户可见的启用账户', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });
    dependencies.prisma.account.findMany.mockResolvedValue([account]);
    dependencies.prisma.account.count.mockResolvedValue(1);

    const result = await dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      includeInactive: false,
    });

    expect(dependencies.prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ledgerId,
          isActive: true,
          OR: [{ visibility: 'SHARED' }, { visibility: 'PRIVATE', ownerId: userId }],
        },
      }),
    );
    expect(result).toEqual({
      items: [account],
      total: 1,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
    });
  });

  it('给定 Viewer 查询停用账户，当请求包含停用账户参数，则拒绝查看', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.list(userId, ledgerId, {
        page: 1,
        pageSize: 20,
        includeInactive: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.prisma.account.findMany).not.toHaveBeenCalled();
  });

  it('给定 Editor 查询停用账户，当账户是本人私人账户，则只查询本人私人账户', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'EDITOR',
      status: 'ACTIVE',
    });
    dependencies.prisma.account.findMany.mockResolvedValue([]);
    dependencies.prisma.account.count.mockResolvedValue(0);

    await dependencies.service.list(userId, ledgerId, {
      page: 1,
      pageSize: 20,
      includeInactive: true,
    });

    expect(dependencies.prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ledgerId,
          OR: [{ visibility: 'PRIVATE', ownerId: userId }],
        },
      }),
    );
  });

  it('给定 Owner 创建共享账户，当提交合法数据，则保存共享账户且不接收客户端 ownerId', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.account.create.mockResolvedValue(account);

    const result = await dependencies.service.create(userId, ledgerId, {
      name: ' 微信 ',
      type: 'WECHAT',
      visibility: 'SHARED',
      initialBalanceCents: 1000,
      includeInAssets: true,
    });

    expect(dependencies.prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ledgerId,
          ownerId: null,
          name: '微信',
          type: 'WECHAT',
          visibility: 'SHARED',
          initialBalanceCents: 1000,
          currentBalanceCents: 1000,
          includeInAssets: true,
        },
      }),
    );
    expect(result).toEqual(account);
  });

  it('给定 Editor 创建私人账户，当提交合法数据，则账户所有者固定为当前用户', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'EDITOR',
      status: 'ACTIVE',
    });
    dependencies.prisma.account.create.mockResolvedValue({
      ...account,
      ownerId: userId,
      visibility: 'PRIVATE',
    });

    await dependencies.service.create(userId, ledgerId, {
      name: '我的现金',
      type: 'CASH',
      visibility: 'PRIVATE',
      initialBalanceCents: 0,
    });

    expect(dependencies.prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: userId, visibility: 'PRIVATE' }),
      }),
    );
  });

  it('给定 Editor 创建共享账户，当提交请求，则拒绝越权写入', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'EDITOR',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.create(userId, ledgerId, {
        name: '共享现金',
        type: 'CASH',
        visibility: 'SHARED',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.prisma.account.create).not.toHaveBeenCalled();
  });

  it('给定 Viewer 创建账户，当提交请求，则拒绝越权写入', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    await expect(
      dependencies.service.create(userId, ledgerId, {
        name: '现金',
        type: 'CASH',
        visibility: 'PRIVATE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dependencies.prisma.account.create).not.toHaveBeenCalled();
  });

  it('给定账户属于其他账本，当用户更新账户，则返回资源不存在错误', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.account.findFirst.mockResolvedValue(null);

    await expect(
      dependencies.service.update(userId, ledgerId, 'account-1', {
        name: '新名称',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dependencies.prisma.account.updateMany).not.toHaveBeenCalled();
  });

  it('给定 Owner 更新共享账户，当提交账户资料，则不能直接修改余额', async () => {
    const dependencies = createService();
    dependencies.prisma.ledgerMember.findUnique.mockResolvedValue({
      role: 'OWNER',
      status: 'ACTIVE',
    });
    dependencies.prisma.account.findFirst.mockResolvedValue(account);
    dependencies.prisma.account.updateMany.mockResolvedValue({ count: 1 });
    dependencies.prisma.account.findUnique.mockResolvedValue({
      ...account,
      name: '新微信',
    });

    const result = await dependencies.service.update(userId, ledgerId, 'account-1', {
      name: ' 新微信 ',
      includeInAssets: false,
      currentBalanceCents: 1,
    } as never);

    expect(dependencies.prisma.account.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'account-1', ledgerId },
        data: { name: '新微信', includeInAssets: false },
      }),
    );
    expect(result).toEqual(expect.objectContaining({ name: '新微信' }));
  });
});
