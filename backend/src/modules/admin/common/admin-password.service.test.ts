import { AdminPasswordService } from './admin-password.service';

describe('AdminPasswordService', () => {
  it('给定管理员原始密码，当生成密码哈希，则只有同一密码校验通过', async () => {
    const service = new AdminPasswordService();
    const encodedHash = await service.hash('admin-password-123');

    await expect(service.verify('admin-password-123', encodedHash)).resolves.toBe(true);
    await expect(service.verify('wrong-password', encodedHash)).resolves.toBe(false);
    expect(encodedHash.startsWith('scrypt$')).toBe(true);
  });

  it('给定非法管理员密码哈希，当执行校验，则返回失败而不抛出异常', async () => {
    const service = new AdminPasswordService();

    await expect(service.verify('admin-password-123', 'invalid-hash')).resolves.toBe(false);
  });
});
