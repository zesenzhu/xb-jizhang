import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  it('给定包含密码和 Token 的审计数据，当记录操作，则保存脱敏后的前后摘要', async () => {
    const prisma = {
      adminAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = new AdminAuditService(prisma as unknown as PrismaService);

    await service.record(prisma as never, {
      adminUserId: 'admin-1',
      requestId: 'request-1',
      action: 'admin.user.status',
      targetType: 'User',
      targetId: 'user-1',
      reason: '处理申诉',
      beforeData: {
        isActive: true,
        password: 'plain',
        password_hash: 'hash',
        access_token: 'access',
        nested: { token: 'secret', jwt_secret: 'secret' },
      },
      afterData: { isActive: false },
      result: 'SUCCESS',
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: '处理申诉',
        beforeData: {
          isActive: true,
          password: '[REDACTED]',
          password_hash: '[REDACTED]',
          access_token: '[REDACTED]',
          nested: { token: '[REDACTED]', jwt_secret: '[REDACTED]' },
        },
      }),
    });
  });
});
