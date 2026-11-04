import { Temporal } from '@js-temporal/polyfill';
import type {
  ResolvedStatisticsGranularity,
  StatisticsDateRange,
} from './statistics.types';

export interface StatisticsPeriodSlot {
  fromDate: string;
  toDate: string;
  drilldown: { from: string; to: string };
}

function startOfLocalDate(date: Temporal.PlainDate, timezone: string): string {
  return date
    .toZonedDateTime({
      timeZone: timezone,
      plainTime: Temporal.PlainTime.from('00:00'),
    })
    .toInstant()
    .toString({ fractionalSecondDigits: 3 });
}

function endOfBucket(
  date: Temporal.PlainDate,
  granularity: ResolvedStatisticsGranularity,
): Temporal.PlainDate {
  if (granularity === 'DAY') return date;
  if (granularity === 'MONTH')
    return date.with({ day: 1 }).add({ months: 1 }).subtract({ days: 1 });
  return Temporal.PlainDate.from({ year: date.year, month: 12, day: 31 });
}

export function buildStatisticsPeriodSlots(
  range: StatisticsDateRange,
): StatisticsPeriodSlot[] {
  if (range.fromDate === null || range.toDate === null) return [];

  const lastDate = Temporal.PlainDate.from(range.toDate);
  let cursor = Temporal.PlainDate.from(range.fromDate);
  const slots: StatisticsPeriodSlot[] = [];

  while (Temporal.PlainDate.compare(cursor, lastDate) <= 0) {
    const bucketEnd = endOfBucket(cursor, range.granularity);
    const clippedEnd =
      Temporal.PlainDate.compare(bucketEnd, lastDate) > 0
        ? lastDate
        : bucketEnd;
    slots.push({
      fromDate: cursor.toString(),
      toDate: clippedEnd.toString(),
      drilldown: {
        from: startOfLocalDate(cursor, range.timezone),
        to: startOfLocalDate(clippedEnd.add({ days: 1 }), range.timezone),
      },
    });
    cursor = clippedEnd.add({ days: 1 });
  }

  return slots;
}

export function statisticsPeriodKey(
  date: string,
  granularity: ResolvedStatisticsGranularity,
): string {
  if (granularity === 'DAY') return date;
  if (granularity === 'MONTH') return `${date.slice(0, 7)}-01`;
  return `${date.slice(0, 4)}-01-01`;
}
