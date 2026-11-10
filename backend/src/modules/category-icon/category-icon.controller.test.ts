import { CategoryIconController } from './category-icon.controller';
import { CategoryIconService } from './category-icon.service';

describe('CategoryIconController', () => {
  it('给定图标库查询，当 Controller 接收路径和用户，则传递查询参数', async () => {
    const service = {
      listLibrary: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new CategoryIconController(
      service as unknown as CategoryIconService,
    );

    await controller.listLibrary({ id: 'user-1' }, 'ledger-1', {
      page: 2,
      pageSize: 10,
      type: 'INCOME',
      q: '工资',
    });

    expect(service.listLibrary).toHaveBeenCalledWith('user-1', 'ledger-1', {
      page: 2,
      pageSize: 10,
      type: 'INCOME',
      q: '工资',
    });
  });

  it('给定新建上传会话，当 Service 返回新资源，则设置 201 并传递允许字段', async () => {
    const service = {
      createUploadSession: jest
        .fn()
        .mockResolvedValue({ reused: false, asset: { assetId: 'asset-1' } }),
    };
    const controller = new CategoryIconController(
      service as unknown as CategoryIconService,
    );
    const response = { status: jest.fn().mockReturnThis() };

    await controller.createUploadSession(
      { id: 'user-1' },
      'ledger-1',
      {
        clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
        fileName: 'icon.png',
        mimeType: 'image/png',
        sizeBytes: 100,
      },
      response as never,
    );

    expect(service.createUploadSession).toHaveBeenCalledWith(
      'user-1',
      'ledger-1',
      {
        clientRequestId: '9d0e8400-e29b-41d4-a716-446655440000',
        fileName: 'icon.png',
        mimeType: 'image/png',
        sizeBytes: 100,
      },
    );
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('给定完成和读取请求，当 Controller 接收资源标识，则传递用户、账本和资源', async () => {
    const service = {
      complete: jest.fn().mockResolvedValue({ assetId: 'asset-1' }),
      getAccessUrl: jest.fn().mockResolvedValue({ accessUrl: 'signed-url' }),
    };
    const controller = new CategoryIconController(
      service as unknown as CategoryIconService,
    );

    await controller.complete({ id: 'user-1' }, 'ledger-1', 'asset-1');
    await controller.getAccessUrl({ id: 'user-1' }, 'ledger-1', 'asset-1');

    expect(service.complete).toHaveBeenCalledWith(
      'user-1',
      'ledger-1',
      'asset-1',
    );
    expect(service.getAccessUrl).toHaveBeenCalledWith(
      'user-1',
      'ledger-1',
      'asset-1',
    );
  });
});
