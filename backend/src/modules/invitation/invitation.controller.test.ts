import { InvitationController, InvitationPublicController } from './invitation.controller';
import { InvitationService } from './invitation.service';

describe('InvitationController', () => {
  it('给定创建邀请请求，当 Owner 提交，则传递当前用户、账本和邀请字段', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'invitation-1' }) };
    const controller = new InvitationController(service as unknown as InvitationService);

    await controller.create({ id: 'user-owner' }, 'ledger-1', {
      targetEmail: 'member@example.com',
      role: 'EDITOR',
    });

    expect(service.create).toHaveBeenCalledWith('user-owner', 'ledger-1', {
      targetEmail: 'member@example.com',
      role: 'EDITOR',
    });
  });

  it('给定接受邀请 Token，当当前用户提交，则传递当前用户和 Token', async () => {
    const service = { accept: jest.fn().mockResolvedValue({}) };
    const controller = new InvitationController(service as unknown as InvitationService);

    await controller.accept({ id: 'user-invited' }, { token: 'invite-token' });

    expect(service.accept).toHaveBeenCalledWith('user-invited', 'invite-token');
  });

  it('给定账本邀请列表请求，当 Owner 查询，则传递当前用户和账本', async () => {
    const service = { listForLedger: jest.fn().mockResolvedValue([]) };
    const controller = new InvitationController(service as unknown as InvitationService);

    await controller.listForLedger({ id: 'user-owner' }, 'ledger-1');

    expect(service.listForLedger).toHaveBeenCalledWith('user-owner', 'ledger-1');
  });
});

describe('InvitationController 三期扩展', () => {
  it('给定邀请记录 ID，当 Controller 接受，则传递当前用户和记录 ID', async () => {
    const service = { acceptById: jest.fn().mockResolvedValue({ id: 'invitation-1' }) };
    const controller = new InvitationController(service as unknown as InvitationService);

    await controller.acceptById({ id: 'user-1' }, 'invitation-1');

    expect(service.acceptById).toHaveBeenCalledWith('user-1', 'invitation-1');
  });

  it('给定邀请 Token，当 Controller 查询详情，则传递当前用户和 Token', async () => {
    const service = { getByToken: jest.fn().mockResolvedValue({ id: 'invitation-1' }) };
    const controller = new InvitationController(service as unknown as InvitationService);

    await controller.detail({ id: 'user-1' }, { token: 'invite-token' });

    expect(service.getByToken).toHaveBeenCalledWith('user-1', 'invite-token');
  });

  it('给定公开预览 Token，当 Controller 查询，则不需要认证上下文', async () => {
    const service = { previewByToken: jest.fn().mockResolvedValue({ ledgerName: '家庭账本' }) };
    const controller = new InvitationPublicController(service as unknown as InvitationService);

    await controller.preview({ token: 'invite-token' });

    expect(service.previewByToken).toHaveBeenCalledWith('invite-token');
  });
});
