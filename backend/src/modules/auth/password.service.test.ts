import { PasswordService } from './password.service';

describe('PasswordService', () => {
  it('给定原始密码，当生成密码哈希，则只能使用同一密码校验通过', async () => {
    const service = new PasswordService();
    const encodedHash = await service.hash('password-123');

    await expect(service.verify('password-123', encodedHash)).resolves.toBe(true);
    await expect(service.verify('wrong-password', encodedHash)).resolves.toBe(false);
    expect(encodedHash.startsWith('scrypt$')).toBe(true);
  });

  it('给定非法密码哈希，当执行校验，则返回失败而不抛出异常', async () => {
    const service = new PasswordService();

    await expect(service.verify('password-123', 'invalid-hash')).resolves.toBe(false);
  });
});
