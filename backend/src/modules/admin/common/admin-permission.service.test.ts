import { AdminPermissionService } from './admin-permission.service';
import type { AdminContext } from './admin.types';

describe('AdminPermissionService', () => {
  const service = new AdminPermissionService({} as never);
  const context: AdminContext = {
    id: 'admin-1',
    username: 'operator',
    displayName: '运营人员',
    roles: ['OPERATOR'],
    permissions: ['admin:user:read'],
  };

  it('给定管理员拥有目标权限，当检查权限，则允许访问', () => {
    expect(service.hasPermission(context, 'admin:user:read')).toBe(true);
  });

  it('给定管理员没有高风险权限，当检查账单修改权限，则拒绝访问', () => {
    expect(service.hasPermission(context, 'admin:transaction:write')).toBe(false);
  });

  it('给定操作原因为空白，当校验高风险操作原因，则返回失败', () => {
    expect(service.validateAuditReason('   ')).toBe(false);
    expect(service.validateAuditReason('用户确认修正')).toBe(true);
  });

  it('给定操作原因只有空白，当强制校验高风险操作原因，则返回业务校验异常', () => {
    expect(() => service.requireAuditReason('   ')).toThrow('高风险操作必须填写合法原因');
    expect(service.requireAuditReason('  用户确认修正  ')).toBe('用户确认修正');
  });
});
