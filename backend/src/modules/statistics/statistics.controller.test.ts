import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

describe('StatisticsController', () => {
  it('给定统计概览请求，当 Controller 接收筛选条件，则传递认证用户、账本和查询参数', async () => {
    const service = { overview: jest.fn().mockResolvedValue({ totalIncomeCents: 10000 }) };
    const controller = new StatisticsController(service as unknown as StatisticsService);
    const query = {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      type: 'EXPENSE' as const,
      categoryId: 'category-1',
      accountId: 'account-1',
      payerId: 'user-2',
      keyword: '早餐',
    };

    await controller.overview({ id: 'user-1' }, 'ledger-1', query);

    expect(service.overview).toHaveBeenCalledWith('user-1', 'ledger-1', query);
  });
});
