import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  name: string;
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      name: 'xiaobao-jizhang-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
