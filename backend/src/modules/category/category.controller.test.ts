import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  it('给定分类查询请求，当 Controller 接收筛选参数，则把用户和账本传入 Service', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new CategoryController(service as unknown as CategoryService);

    await controller.list(
      { id: 'user-1' },
      'ledger-1',
      { page: 2, pageSize: 10, type: 'INCOME', includeInactive: true },
    );

    expect(service.list).toHaveBeenCalledWith('user-1', 'ledger-1', {
      page: 2,
      pageSize: 10,
      type: 'INCOME',
      includeInactive: true,
    });
  });

  it('给定创建分类请求，当 Controller 接收参数，则只把允许字段传入 Service', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'category-1' }) };
    const controller = new CategoryController(service as unknown as CategoryService);

    await controller.create(
      { id: 'user-1' },
      'ledger-1',
      { type: 'EXPENSE', name: '餐饮', sortOrder: 10 },
    );

    expect(service.create).toHaveBeenCalledWith('user-1', 'ledger-1', {
      type: 'EXPENSE',
      name: '餐饮',
      sortOrder: 10,
      icon: undefined,
      color: undefined,
    });
  });

  it('给定编辑分类请求，当 Controller 接收参数，则传递资源标识和编辑字段', async () => {
    const service = { update: jest.fn().mockResolvedValue({ id: 'category-1' }) };
    const controller = new CategoryController(service as unknown as CategoryService);

    await controller.update(
      { id: 'user-1' },
      'ledger-1',
      'category-1',
      { name: '新餐饮', sortOrder: 20, isActive: false },
    );

    expect(service.update).toHaveBeenCalledWith('user-1', 'ledger-1', 'category-1', {
      name: '新餐饮',
      sortOrder: 20,
      icon: undefined,
      color: undefined,
      isActive: false,
    });
  });
});
