import { LedgerMemberController } from './ledger-member.controller';
import { LedgerMemberService } from './ledger-member.service';

describe('LedgerMemberController', () => {
  it('给定成员角色修改请求，当 Owner 提交，则把账本、成员和角色传入 Service', async () => {
    const service = { updateRole: jest.fn().mockResolvedValue({ id: 'member-1' }) };
    const controller = new LedgerMemberController(service as unknown as LedgerMemberService);

    await controller.updateRole(
      { id: 'user-owner' },
      'ledger-1',
      'member-1',
      { role: 'VIEWER' },
    );

    expect(service.updateRole).toHaveBeenCalledWith(
      'user-owner',
      'ledger-1',
      'member-1',
      'VIEWER',
    );
  });

  it('给定 Owner 转移请求，当 Controller 接收，则传递当前用户和目标成员', async () => {
    const service = { transferOwnership: jest.fn().mockResolvedValue({}) };
    const controller = new LedgerMemberController(service as unknown as LedgerMemberService);

    await controller.transferOwnership({ id: 'user-owner' }, 'ledger-1', {
      targetMemberId: 'member-target',
    });

    expect(service.transferOwnership).toHaveBeenCalledWith(
      'user-owner',
      'ledger-1',
      'member-target',
    );
  });

  it('给定成员分页参数，当用户查询成员，则把分页参数传入 Service', async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const controller = new LedgerMemberController(service as unknown as LedgerMemberService);

    await controller.list({ id: 'user-1' }, 'ledger-1', { page: 2, pageSize: 10 });

    expect(service.list).toHaveBeenCalledWith('user-1', 'ledger-1', 2, 10);
  });
});
