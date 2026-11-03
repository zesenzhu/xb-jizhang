import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../modules/prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const createService = () => {
    const prisma = { $queryRaw: jest.fn() };
    return {
      prisma,
      service: new HealthService(prisma as unknown as PrismaService),
    };
  };

  it('给定数据库已连接且迁移已应用，当读取健康状态，则返回 database 与 schema 均正常', async () => {
    const dependencies = createService();
    dependencies.prisma.$queryRaw.mockResolvedValue([{ done: 1 }]);

    const response = await dependencies.service.getHealth();

    expect(response).toMatchObject({
      name: 'xiaobao-jizhang-backend',
      status: 'ok',
      database: 'ok',
      schema: 'ok',
    });
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('给定数据库连得上但从未应用迁移，当读取健康状态，则抛出 503 而不是返回 ok', async () => {
    const dependencies = createService();
    dependencies.prisma.$queryRaw.mockRejectedValue(
      new Error('The table `public._prisma_migrations` does not exist in the current database.'),
    );
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      await expect(dependencies.service.getHealth()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(logError).toHaveBeenCalled();
    } finally {
      logError.mockRestore();
    }
  });
});
