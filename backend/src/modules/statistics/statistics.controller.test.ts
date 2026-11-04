import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

describe('StatisticsController', () => {
  it('给定非法 period、granularity 和自然日期格式，当校验统计参数，则返回对应字段错误', () => {
    const dto = plainToInstance(QueryStatisticsDto, {
      period: 'DAY',
      anchorDate: '2026-2-31',
      granularity: 'HOUR',
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(
      expect.arrayContaining(['period', 'anchorDate', 'granularity']),
    );
  });

  it('给定趋势 metric 不在允许值内，当校验统计参数，则返回 metric 字段错误', () => {
    const dto = plainToInstance(QueryStatisticsDto, {
      period: 'MONTH',
      anchorDate: '2026-10-15',
      metric: 'BALANCE',
    });

    expect(validateSync(dto).map(({ property }) => property)).toContain(
      'metric',
    );
  });

  it.each([
    { period: 'WEEK', fromDate: '2026-10-01', toDate: '2026-10-07' },
    {
      period: 'RANGE',
      anchorDate: '2026-10-01',
      fromDate: '2026-10-01',
      toDate: '2026-10-07',
    },
    { period: 'ALL', fromDate: '2026-10-01', toDate: '2026-10-07' },
    { period: 'MONTH' },
    { anchorDate: '2026-10-01' },
    { period: 'WEEK', anchorDate: '2026-10-01', granularity: 'MONTH' },
  ])(
    '给定互相冲突或缺失的统计周期参数 $period，当校验 DTO，则返回参数错误',
    (query) => {
      const dto = plainToInstance(QueryStatisticsDto, query);

      expect(validateSync(dto).map(({ property }) => property)).toContain(
        'period',
      );
    },
  );

  it('给定完整 RANGE 或旧 ISO from/to 参数，当校验 DTO，则允许兼容请求', () => {
    const range = plainToInstance(QueryStatisticsDto, {
      period: 'RANGE',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });
    const legacy = plainToInstance(QueryStatisticsDto, {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
    });

    expect(validateSync(range)).toHaveLength(0);
    expect(validateSync(legacy)).toHaveLength(0);
  });

  it('给定带时间部分的自定义范围日期，当校验 DTO，则拒绝非自然日期格式', () => {
    const dto = plainToInstance(QueryStatisticsDto, {
      period: 'RANGE',
      fromDate: '2026-10-01T00:00:00.000Z',
      toDate: '2026-10-31',
    });

    expect(validateSync(dto).map(({ property }) => property)).toContain(
      'fromDate',
    );
  });

  it('给定同时填写 categoryId 和 categoryRootId，当校验 DTO，则拒绝互斥分类', () => {
    const dto = plainToInstance(QueryStatisticsDto, {
      categoryId: 'c870a1fa-2600-4c29-b482-7c8132123456',
      categoryRootId: 'c870a1fa-2600-4c29-b482-7c8132123457',
    });

    expect(validateSync(dto).map(({ property }) => property)).toContain(
      'categoryRootId',
    );
  });

  it('给定趋势与周期汇总请求，当 Controller 接收筛选条件，则传递认证用户、账本和完整查询参数', async () => {
    const service = {
      trend: jest.fn().mockResolvedValue({ hasData: false, items: [] }),
      periods: jest.fn().mockResolvedValue({ items: [] }),
    };
    const controller = new StatisticsController(
      service as unknown as StatisticsService,
    );
    const query = {
      period: 'MONTH' as const,
      anchorDate: '2026-10-15',
      granularity: 'DAY' as const,
      metric: 'NET' as const,
      payerId: 'user-2',
    };

    const actions = controller as unknown as Record<string, unknown>;
    const trend = actions.trend;
    const periods = actions.periods;
    expect(trend).toEqual(expect.any(Function));
    expect(periods).toEqual(expect.any(Function));
    if (typeof trend !== 'function' || typeof periods !== 'function') return;

    await trend.call(controller, { id: 'user-1' }, 'ledger-1', query);
    await periods.call(controller, { id: 'user-1' }, 'ledger-1', query);

    expect(service.trend).toHaveBeenCalledWith('user-1', 'ledger-1', query);
    expect(service.periods).toHaveBeenCalledWith('user-1', 'ledger-1', query);
  });

  it('给定统计概览请求，当 Controller 接收筛选条件，则传递认证用户、账本和查询参数', async () => {
    const service = {
      overview: jest.fn().mockResolvedValue({ totalIncomeCents: 10000 }),
    };
    const controller = new StatisticsController(
      service as unknown as StatisticsService,
    );
    const query = {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      type: 'EXPENSE' as const,
      categoryId: 'category-1',
      accountId: 'account-1',
      payerId: 'user-2',
      keyword: '早餐',
    };

    await controller.overview({ id: 'user-1' }, 'ledger-1', query);

    expect(service.overview).toHaveBeenCalledWith('user-1', 'ledger-1', query);
  });
});
