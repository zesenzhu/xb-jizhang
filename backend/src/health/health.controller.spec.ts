import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns an operational health response with an ISO timestamp', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    const response = moduleRef.get(HealthController).getHealth();

    expect(response.status).toBe('ok');
    expect(response.name).toBe('xiaobao-jizhang-backend');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
