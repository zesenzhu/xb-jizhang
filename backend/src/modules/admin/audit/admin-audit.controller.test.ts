import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditController', () => {
  it('给定审计筛选条件，当管理员查询日志，则传递分页、目标和时间范围', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new AdminAuditController(service as unknown as AdminAuditService);

    await controller.list({
      page: 2,
      pageSize: 10,
      action: 'admin.user.status',
      createdFrom: '2026-10-01T00:00:00.000Z',
    });

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        action: 'admin.user.status',
        createdFrom: new Date('2026-10-01T00:00:00.000Z'),
      }),
    );
  });
});
