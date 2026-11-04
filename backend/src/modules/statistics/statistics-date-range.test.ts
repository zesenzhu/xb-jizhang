import { BadRequestException } from '@nestjs/common';
import { resolveStatisticsDateRange } from './statistics-date-range';

function expectBadRequestCode(action: () => unknown, code: number): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getResponse()).toMatchObject({ code });
}

describe('resolveStatisticsDateRange', () => {
  it('给定周中的任意日期，当按账本本地周解析，则返回周一至周日的 UTC 半开区间', () => {
    expect(
      resolveStatisticsDateRange(
        { period: 'WEEK', anchorDate: '2026-11-04' },
        'America/New_York',
        { today: '2026-11-30' },
      ),
    ).toEqual({
      period: 'WEEK',
      timezone: 'America/New_York',
      fromDate: '2026-11-02',
      toDate: '2026-11-08',
      startAt: '2026-11-02T05:00:00.000Z',
      endAt: '2026-11-09T05:00:00.000Z',
      granularity: 'DAY',
    });
  });

  it('给定闰年二月最后一天，当解析月份范围，则包含 2 月 29 日', () => {
    expect(
      resolveStatisticsDateRange(
        { period: 'MONTH', anchorDate: '2024-02-29' },
        'Asia/Shanghai',
        { today: '2024-12-31' },
      ),
    ).toEqual({
      period: 'MONTH',
      timezone: 'Asia/Shanghai',
      fromDate: '2024-02-01',
      toDate: '2024-02-29',
      startAt: '2024-01-31T16:00:00.000Z',
      endAt: '2024-02-29T16:00:00.000Z',
      granularity: 'DAY',
    });
  });

  it.each([
    ['2026-03-08', '2026-03-08T08:00:00.000Z', '2026-03-09T07:00:00.000Z', 23],
    ['2026-11-01', '2026-11-01T07:00:00.000Z', '2026-11-02T08:00:00.000Z', 25],
  ])(
    '给定洛杉矶本地日期 %s，当解析夏令时边界，则按实际自然日长度转换',
    (date, startAt, endAt, hours) => {
      const range = resolveStatisticsDateRange(
        { period: 'RANGE', fromDate: date as string, toDate: date as string },
        'America/Los_Angeles',
        { today: '2026-12-31' },
      );

      expect(range.startAt).toBe(startAt);
      expect(range.endAt).toBe(endAt);
      expect(
        (Date.parse(range.endAt!) - Date.parse(range.startAt!)) / 3_600_000,
      ).toBe(hours);
    },
  );

  it('给定 AUTO 粒度的不同日期范围，当解析统计周期，则按接口规则选择日、月或年', () => {
    const options = { today: '2026-12-31' };
    expect(
      resolveStatisticsDateRange(
        { period: 'RANGE', fromDate: '2026-01-01', toDate: '2026-04-03' },
        'Asia/Shanghai',
        options,
      ).granularity,
    ).toBe('DAY');
    expect(
      resolveStatisticsDateRange(
        { period: 'RANGE', fromDate: '2026-01-01', toDate: '2026-04-04' },
        'Asia/Shanghai',
        options,
      ).granularity,
    ).toBe('MONTH');
    expect(
      resolveStatisticsDateRange(
        { period: 'RANGE', fromDate: '2020-01-01', toDate: '2026-01-01' },
        'Asia/Shanghai',
        options,
      ).granularity,
    ).toBe('YEAR');
    expect(
      resolveStatisticsDateRange(
        { period: 'YEAR', anchorDate: '2026-01-01' },
        'Asia/Shanghai',
        options,
      ).granularity,
    ).toBe('MONTH');
  });

  it('给定没有可见账单的 ALL 范围，当解析日期，则所有日期边界为空', () => {
    expect(
      resolveStatisticsDateRange({ period: 'ALL' }, 'Asia/Shanghai', {
        today: '2026-11-04',
      }),
    ).toEqual({
      period: 'ALL',
      timezone: 'Asia/Shanghai',
      fromDate: null,
      toDate: null,
      startAt: null,
      endAt: null,
      granularity: 'YEAR',
    });
  });

  it('给定有可见账单的 ALL 范围，当解析日期，则从首笔账单本地日期覆盖到今天', () => {
    expect(
      resolveStatisticsDateRange({ period: 'ALL' }, 'Asia/Shanghai', {
        today: '2026-11-04',
        allStartDate: '2020-06-15',
      }),
    ).toEqual({
      period: 'ALL',
      timezone: 'Asia/Shanghai',
      fromDate: '2020-06-15',
      toDate: '2026-11-04',
      startAt: '2020-06-14T16:00:00.000Z',
      endAt: '2026-11-04T16:00:00.000Z',
      granularity: 'YEAR',
    });
  });

  it('给定恰好 3660 个本地自然日的自定义范围，当解析范围，则允许请求', () => {
    expect(
      resolveStatisticsDateRange(
        {
          period: 'RANGE',
          fromDate: '2017-01-01',
          toDate: '2027-01-08',
          granularity: 'YEAR',
        },
        'Asia/Shanghai',
        { today: '2027-01-08' },
      ),
    ).toEqual({
      period: 'RANGE',
      timezone: 'Asia/Shanghai',
      fromDate: '2017-01-01',
      toDate: '2027-01-08',
      startAt: '2016-12-31T16:00:00.000Z',
      endAt: '2027-01-08T16:00:00.000Z',
      granularity: 'YEAR',
    });
  });

  it.each([
    [
      { period: 'WEEK', anchorDate: '2026-12-01' },
      'Asia/Shanghai',
      { today: '2026-11-30' },
    ],
    [
      { period: 'RANGE', fromDate: '2026-11-02', toDate: '2026-11-01' },
      'Asia/Shanghai',
      { today: '2026-11-30' },
    ],
    [
      { period: 'RANGE', fromDate: '2026-02-29', toDate: '2026-03-01' },
      'Asia/Shanghai',
      { today: '2026-11-30' },
    ],
    [
      { period: 'RANGE', fromDate: '2026-11-01', toDate: '2026-11-02' },
      'Mars/Olympus',
      { today: '2026-11-30' },
    ],
  ])(
    '给定未来日期、非法自然日、反向范围或无效时区，当解析范围，则返回 40021',
    (query, timezone, options) => {
      expectBadRequestCode(
        () =>
          resolveStatisticsDateRange(
            query as never,
            timezone as string,
            options as never,
          ),
        40021,
      );
    },
  );

  it('给定超过日期跨度或分组周期上限的范围，当解析 RANGE，则返回范围超限错误', () => {
    const today = '2026-12-31';
    expectBadRequestCode(
      () =>
        resolveStatisticsDateRange(
          { period: 'RANGE', fromDate: '2010-01-01', toDate: '2020-01-10' },
          'Asia/Shanghai',
          { today },
        ),
      40022,
    );
    expectBadRequestCode(
      () =>
        resolveStatisticsDateRange(
          {
            period: 'RANGE',
            fromDate: '2010-01-01',
            toDate: '2020-01-01',
            granularity: 'MONTH',
          },
          'Asia/Shanghai',
          { today },
        ),
      40022,
    );
    expectBadRequestCode(
      () =>
        resolveStatisticsDateRange(
          {
            period: 'RANGE',
            fromDate: '2025-01-01',
            toDate: '2026-01-02',
            granularity: 'DAY',
          },
          'Asia/Shanghai',
          { today },
        ),
      40022,
    );
    expectBadRequestCode(
      () =>
        resolveStatisticsDateRange({ period: 'ALL' }, 'Asia/Shanghai', {
          today,
          allStartDate: '1890-01-01',
        }),
      40022,
    );
  });
});
