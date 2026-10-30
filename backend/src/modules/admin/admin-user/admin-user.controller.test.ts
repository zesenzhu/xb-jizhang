import { AdminUserController } from './admin-user.controller';
import { AdminUserService } from './admin-user.service';

describe('AdminUserController', () => {
  it('给定管理员账号查询参数，当请求管理员列表，则传递分页和状态筛选', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new AdminUserController(service as unknown as AdminUserService);

    await controller.list({ page: 1, pageSize: 20, status: 'ACTIVE' });

    expect(service.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: 'ACTIVE',
      keyword: undefined,
    });
  });
});
