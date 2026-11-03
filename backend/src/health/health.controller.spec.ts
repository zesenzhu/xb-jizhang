import { Test } from '@nestjs/testing';
import { PrismaService } from '../modules/prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('给定数据库可用，当请求健康检查，则返回可用的健康响应', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([1]) } },
      ],
    }).compile();

    const response = await moduleRef.get(HealthController).getHealth();

    expect(response.status).toBe('ok');
    expect(response.database).toBe('ok');
    expect(response.schema).toBe('ok');
    expect(response.name).toBe('xiaobao-jizhang-backend');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
