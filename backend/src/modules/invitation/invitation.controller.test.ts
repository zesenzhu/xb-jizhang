import { InvitationController } from './invitation.controller';
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
});
