import { AdminLedgerController } from './admin-ledger.controller';
import { AdminLedgerService } from './admin-ledger.service';

describe('AdminLedgerController', () => {
  it('给定账本筛选参数，当管理员请求列表，则传递明确的管理查询条件', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new AdminLedgerController(service as unknown as AdminLedgerService);

    await controller.list({ page: 1, pageSize: 20, status: 'ACTIVE', type: 'SHARED' });

    expect(service.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: 'ACTIVE',
      type: 'SHARED',
      keyword: undefined,
    });
  });
});
