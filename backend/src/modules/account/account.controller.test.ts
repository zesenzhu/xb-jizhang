import { AccountController } from './account.controller';
import { AccountService } from './account.service';

describe('AccountController', () => {
  it('给定账户查询请求，当 Controller 接收分页参数，则把账本和认证用户传入 Service', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new AccountController(service as unknown as AccountService);

    await controller.list(
      { id: 'user-1' },
      'ledger-1',
      { page: 2, pageSize: 10, includeInactive: true },
    );

    expect(service.list).toHaveBeenCalledWith('user-1', 'ledger-1', {
      page: 2,
      pageSize: 10,
      includeInactive: true,
    });
  });

  it('给定创建私人账户请求，当 Controller 接收参数，则只把允许字段传入 Service', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'account-1' }) };
    const controller = new AccountController(service as unknown as AccountService);

    await controller.create(
      { id: 'user-1' },
      'ledger-1',
      {
        name: '现金',
        type: 'CASH',
        visibility: 'PRIVATE',
        initialBalanceCents: 100,
        includeInAssets: true,
      },
    );

    expect(service.create).toHaveBeenCalledWith('user-1', 'ledger-1', {
      name: '现金',
      type: 'CASH',
      visibility: 'PRIVATE',
      initialBalanceCents: 100,
      includeInAssets: true,
      icon: undefined,
      color: undefined,
    });
  });

  it('给定编辑账户请求，当 Controller 接收参数，则传递账户标识和编辑字段', async () => {
    const service = { update: jest.fn().mockResolvedValue({ id: 'account-1' }) };
    const controller = new AccountController(service as unknown as AccountService);

    await controller.update(
      { id: 'user-1' },
      'ledger-1',
      'account-1',
      { name: '新现金', isActive: false },
    );

    expect(service.update).toHaveBeenCalledWith('user-1', 'ledger-1', 'account-1', {
      name: '新现金',
      icon: undefined,
      color: undefined,
      includeInAssets: undefined,
      isActive: false,
    });
  });
});
