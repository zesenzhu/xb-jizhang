import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../modules/prisma/prisma.service';

export interface HealthResponse {
  name: string;
  status: 'ok';
  database: 'ok';
  schema: 'ok';
  timestamp: string;
}

/** 数据库不可用时返回的最小诊断信息，避免健康检查本身泄露连接串或表名。 */
const unhealthyBody = {
  name: 'xiaobao-jizhang-backend',
  status: 'error',
  database: 'error',
  schema: 'error',
} as const;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 健康检查必须同时验证连接与迁移状态，不能只跑 SELECT 1：
   * 空库上 SELECT 1 依然成功，而迁移从未执行时应用所有写操作都会 500。
   * 探针改为查询 Prisma 的迁移记录表——它由 migrate deploy 创建，
   * 存在即证明连接可用且 schema 已初始化。
   */
  async getHealth(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1 FROM _prisma_migrations LIMIT 1`;
    } catch (error) {
      this.logger.error(
        '健康检查数据库探测失败：连接不可用或数据库尚未应用迁移',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException({
        code: 50301,
        message: '数据库不可用或尚未完成迁移',
        data: { ...unhealthyBody, timestamp },
      });
    }

    return {
      name: 'xiaobao-jizhang-backend',
      status: 'ok',
      database: 'ok',
      schema: 'ok',
      timestamp,
    };
  }
}
