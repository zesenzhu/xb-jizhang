import { AdminUserManagementController } from './admin-user-management.controller';
import { AdminUserManagementService } from './admin-user-management.service';

describe('AdminUserManagementController', () => {
  it('给定用户查询参数，当管理员请求用户列表，则按 DTO 传递分页和筛选条件', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new AdminUserManagementController(
      service as unknown as AdminUserManagementService,
    );

    await controller.list({ page: 2, pageSize: 10, keyword: 'xiao' });

    expect(service.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      keyword: 'xiao',
      createdFrom: undefined,
      createdTo: undefined,
    });
  });

  it('给定管理员状态修改请求，当 Controller 调用更新接口，则传递认证上下文和并发时间', async () => {
    const service = { updateStatus: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    const controller = new AdminUserManagementController(
      service as unknown as AdminUserManagementService,
    );
    const request = {
      adminUser: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-1' },
      ip: '127.0.0.1',
    };

    await controller.updateStatus(
      'user-1',
      {
        status: 'INACTIVE',
        reason: '处理申诉',
        updatedAt: '2026-10-30T08:00:00.000Z',
      },
      request as never,
      'test-agent',
    );

    expect(service.updateStatus).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ status: 'INACTIVE', updatedAt: new Date('2026-10-30T08:00:00.000Z') }),
      expect.objectContaining({ id: 'admin-1' }),
      { requestId: 'request-1', ip: '127.0.0.1', userAgent: 'test-agent' },
    );
  });
});
