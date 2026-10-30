import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

describe('LedgerController', () => {
  it('给定带归档参数的账本列表请求，当用户查询账本，则把查询参数和认证用户传入 Service', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new LedgerController(service as unknown as LedgerService);

    await controller.list({ id: 'user-1' }, { page: 2, pageSize: 10, includeArchived: true });

    expect(service.list).toHaveBeenCalledWith('user-1', {
      page: 2,
      pageSize: 10,
      includeArchived: true,
    });
  });

  it('给定创建账本请求，当 Controller 接收参数，则只把允许字段传入 Service', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'ledger-1' }) };
    const controller = new LedgerController(service as unknown as LedgerService);

    await controller.create(
      { id: 'user-1' },
      { name: '家庭账本', type: 'SHARED', defaultCurrency: 'CNY' },
    );

    expect(service.create).toHaveBeenCalledWith('user-1', {
      name: '家庭账本',
      type: 'SHARED',
      defaultCurrency: 'CNY',
      icon: undefined,
      color: undefined,
    });
  });
});
