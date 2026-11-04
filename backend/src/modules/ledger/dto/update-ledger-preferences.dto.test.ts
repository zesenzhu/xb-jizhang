import { validate } from 'class-validator';
import { UpdateLedgerPreferencesDto } from './update-ledger-preferences.dto';

describe('UpdateLedgerPreferencesDto', () => {
  it('给定显式 null 的账本 ID，当校验偏好请求，则拒绝非 UUID 值', async () => {
    const dto = Object.assign(new UpdateLedgerPreferencesDto(), { currentLedgerId: null });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});
