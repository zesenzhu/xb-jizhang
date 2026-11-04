import type { StatisticsDateRange } from './statistics.types';
import { buildStatisticsPeriodSlots } from './statistics-periods';

describe('buildStatisticsPeriodSlots', () => {
  it('给定日粒度范围，当生成周期，则逐日本地对齐并返回 UTC 半开下钻区间', () => {
    const range: StatisticsDateRange = {
      period: 'RANGE',
      timezone: 'Asia/Shanghai',
      fromDate: '2026-10-01',
      toDate: '2026-10-03',
      startAt: '2026-09-30T16:00:00.000Z',
      endAt: '2026-10-03T16:00:00.000Z',
      granularity: 'DAY',
    };

    expect(buildStatisticsPeriodSlots(range)).toEqual([
      {
        fromDate: '2026-10-01',
        toDate: '2026-10-01',
        drilldown: {
          from: '2026-09-30T16:00:00.000Z',
          to: '2026-10-01T16:00:00.000Z',
        },
      },
      {
        fromDate: '2026-10-02',
        toDate: '2026-10-02',
        drilldown: {
          from: '2026-10-01T16:00:00.000Z',
          to: '2026-10-02T16:00:00.000Z',
        },
      },
      {
        fromDate: '2026-10-03',
        toDate: '2026-10-03',
        drilldown: {
          from: '2026-10-02T16:00:00.000Z',
          to: '2026-10-03T16:00:00.000Z',
        },
      },
    ]);
  });

  it('给定跨月范围和月粒度，当生成周期，则裁剪首尾部分月份', () => {
    const range: StatisticsDateRange = {
      period: 'RANGE',
      timezone: 'Asia/Shanghai',
      fromDate: '2026-10-30',
      toDate: '2026-12-02',
      startAt: '2026-10-29T16:00:00.000Z',
      endAt: '2026-12-02T16:00:00.000Z',
      granularity: 'MONTH',
    };

    expect(buildStatisticsPeriodSlots(range)).toEqual([
      {
        fromDate: '2026-10-30',
        toDate: '2026-10-31',
        drilldown: {
          from: '2026-10-29T16:00:00.000Z',
          to: '2026-10-31T16:00:00.000Z',
        },
      },
      {
        fromDate: '2026-11-01',
        toDate: '2026-11-30',
        drilldown: {
          from: '2026-10-31T16:00:00.000Z',
          to: '2026-11-30T16:00:00.000Z',
        },
      },
      {
        fromDate: '2026-12-01',
        toDate: '2026-12-02',
        drilldown: {
          from: '2026-11-30T16:00:00.000Z',
          to: '2026-12-02T16:00:00.000Z',
        },
      },
    ]);
  });

  it('给定跨年范围和年粒度，当生成周期，则按本地年份裁剪边界', () => {
    const range: StatisticsDateRange = {
      period: 'RANGE',
      timezone: 'Asia/Shanghai',
      fromDate: '2025-12-31',
      toDate: '2026-01-02',
      startAt: '2025-12-30T16:00:00.000Z',
      endAt: '2026-01-02T16:00:00.000Z',
      granularity: 'YEAR',
    };

    expect(buildStatisticsPeriodSlots(range)).toEqual([
      {
        fromDate: '2025-12-31',
        toDate: '2025-12-31',
        drilldown: {
          from: '2025-12-30T16:00:00.000Z',
          to: '2025-12-31T16:00:00.000Z',
        },
      },
      {
        fromDate: '2026-01-01',
        toDate: '2026-01-02',
        drilldown: {
          from: '2025-12-31T16:00:00.000Z',
          to: '2026-01-02T16:00:00.000Z',
        },
      },
    ]);
  });

  it.each([
    ['2026-03-08', '2026-03-08T08:00:00.000Z', '2026-03-09T07:00:00.000Z'],
    ['2026-11-01', '2026-11-01T07:00:00.000Z', '2026-11-02T08:00:00.000Z'],
  ])(
    '给定洛杉矶 DST 日期 %s，当生成日周期，则下钻范围采用当地零点',
    (date, from, to) => {
      const range: StatisticsDateRange = {
        period: 'RANGE',
        timezone: 'America/Los_Angeles',
        fromDate: date as string,
        toDate: date as string,
        startAt: from as string,
        endAt: to as string,
        granularity: 'DAY',
      };

      expect(buildStatisticsPeriodSlots(range)).toEqual([
        {
          fromDate: date,
          toDate: date,
          drilldown: { from, to },
        },
      ]);
    },
  );

  it('给定 ALL 没有可见账单的空范围，当生成周期，则返回空数组', () => {
    expect(
      buildStatisticsPeriodSlots({
        period: 'ALL',
        timezone: 'Asia/Shanghai',
        fromDate: null,
        toDate: null,
        startAt: null,
        endAt: null,
        granularity: 'YEAR',
      }),
    ).toEqual([]);
  });
});
