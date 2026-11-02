import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

describe('TransactionController', () => {
  it('给定创建账单请求，当 Controller 接收参数，则只传递认证用户和允许字段', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'transaction-1' }) };
    const controller = new TransactionController(service as unknown as TransactionService);

    await controller.create(
      { id: 'user-1' },
      'ledger-1',
      {
        clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
        type: 'EXPENSE',
        amountCents: 3500,
        occurredAt: '2026-10-31T08:00:00.000Z',
        categoryId: 'category-1',
        accountId: 'account-1',
        payerId: 'user-2',
        title: '早餐',
        note: null,
      },
    );

    expect(service.create).toHaveBeenCalledWith('user-1', 'ledger-1', {
      clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
      type: 'EXPENSE',
      amountCents: 3500,
      occurredAt: '2026-10-31T08:00:00.000Z',
      categoryId: 'category-1',
      accountId: 'account-1',
      payerId: 'user-2',
      title: '早餐',
      note: null,
    });
  });

  it('给定账单详情请求，当 Controller 接收路径参数，则传递认证用户和资源标识', async () => {
    const service = { getDetail: jest.fn().mockResolvedValue({ id: 'transaction-1' }) };
    const controller = new TransactionController(service as unknown as TransactionService);

    await controller.getDetail({ id: 'user-1' }, 'ledger-1', 'transaction-1');

    expect(service.getDetail).toHaveBeenCalledWith('user-1', 'ledger-1', 'transaction-1');
  });

  it('给定账单列表请求，当 Controller 接收筛选参数，则把用户、账本和查询条件传入 Service', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new TransactionController(service as unknown as TransactionService);
    const query = { page: 2, pageSize: 10, type: 'INCOME' as const, keyword: '工资' };

    await controller.list({ id: 'user-1' }, 'ledger-1', query);

    expect(service.list).toHaveBeenCalledWith('user-1', 'ledger-1', query);
  });
});
