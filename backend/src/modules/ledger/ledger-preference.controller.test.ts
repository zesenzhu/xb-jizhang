import { LedgerPreferenceController } from './ledger-preference.controller';
import { LedgerPreferenceService } from './ledger-preference.service';

describe('LedgerPreferenceController', () => {
  it('给定登录用户读取偏好，当请求当前账本设置，则使用认证用户 ID 查询', async () => {
    const service = { get: jest.fn().mockResolvedValue({ currentLedgerId: 'ledger-1' }) };
    const controller = new LedgerPreferenceController(
      service as unknown as LedgerPreferenceService,
    );

    await controller.get({ id: 'user-1' });

    expect(service.get).toHaveBeenCalledWith('user-1');
  });

  it('给定只更新默认账本的请求，当 Controller 收到参数，则只传递允许的偏好字段', async () => {
    const service = { update: jest.fn().mockResolvedValue({ defaultLedgerId: 'ledger-2' }) };
    const controller = new LedgerPreferenceController(
      service as unknown as LedgerPreferenceService,
    );

    await controller.update({ id: 'user-1' }, { defaultLedgerId: 'ledger-2' });

    expect(service.update).toHaveBeenCalledWith('user-1', {
      currentLedgerId: undefined,
      defaultLedgerId: 'ledger-2',
    });
  });
});
