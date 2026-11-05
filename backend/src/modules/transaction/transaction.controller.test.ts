import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

describe('TransactionController', () => {
  it('给定 categoryRootId 不是 UUID，当校验账单列表参数，则返回字段校验错误', () => {
    const dto = plainToInstance(QueryTransactionsDto, {
      page: 1,
      pageSize: 20,
      categoryRootId: 'not-a-uuid',
    });

    expect(validateSync(dto).some(({ property }) => property === 'categoryRootId')).toBe(true);
  });

  it('给定未分类参数，当校验账单列表参数，则转换布尔字符串并允许合法值', () => {
    const dto = plainToInstance(QueryTransactionsDto, { uncategorized: 'true' });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.uncategorized).toBe(true);
  });

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
    const query = {
      page: 2,
      pageSize: 10,
      type: 'INCOME' as const,
      keyword: '工资',
      categoryRootId: '11111111-1111-4111-8111-111111111111',
    };

    await controller.list({ id: 'user-1' }, 'ledger-1', query);

    expect(service.list).toHaveBeenCalledWith('user-1', 'ledger-1', query);
  });

  it('给定编辑账单请求，当 Controller 接收参数，则传递认证用户、账本和账单标识', async () => {
    const service = { update: jest.fn().mockResolvedValue({ id: 'transaction-1' }) };
    const controller = new TransactionController(service as unknown as TransactionService);

    await controller.update(
      { id: 'user-1' },
      'ledger-1',
      'transaction-1',
      { version: 1, amountCents: 4000, title: '早餐和咖啡' },
    );

    expect(service.update).toHaveBeenCalledWith('user-1', 'ledger-1', 'transaction-1', {
      version: 1,
      amountCents: 4000,
      title: '早餐和咖啡',
    });
  });

  it('给定删除账单请求，当 Controller 接收路径和版本，则传递认证用户、账本、账单标识和版本', async () => {
    const service = { remove: jest.fn().mockResolvedValue({ id: 'transaction-1' }) };
    const controller = new TransactionController(service as unknown as TransactionService);

    await controller.remove({ id: 'user-1' }, 'ledger-1', 'transaction-1', { version: 1 });

    expect(service.remove).toHaveBeenCalledWith('user-1', 'ledger-1', 'transaction-1', 1);
  });
});
