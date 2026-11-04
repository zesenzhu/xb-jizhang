import { BadRequestException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { isLedgerTimezone } from '../ledger/ledger-timezone.validator';
import type {
  ResolvedStatisticsGranularity,
  StatisticsDateRange,
  StatisticsDateRangeQuery,
  StatisticsPeriod,
} from './statistics.types';

const maximumRangeDays = 3660;
const maximumPeriods: Record<ResolvedStatisticsGranularity, number> = {
  DAY: 366,
  MONTH: 120,
  YEAR: 120,
};

export interface StatisticsDateRangeOptions {
  today?: string;
  allStartDate?: string;
}

function invalidInputException(): BadRequestException {
  return new BadRequestException({
    code: 40021,
    message: '统计参数不合法',
    data: null,
  });
}

function rangeTooBroadException(): BadRequestException {
  return new BadRequestException({
    code: 40022,
    message: '统计范围过大',
    data: null,
  });
}

function parsePlainDate(value: string | undefined): Temporal.PlainDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalidInputException();
  }
  try {
    return Temporal.PlainDate.from(value, { overflow: 'reject' });
  } catch {
    throw invalidInputException();
  }
}

function resolveGranularity(
  query: StatisticsDateRangeQuery,
  period: StatisticsPeriod,
  fromDate: Temporal.PlainDate,
  toDate: Temporal.PlainDate,
): ResolvedStatisticsGranularity {
  const requested = query.granularity ?? 'AUTO';
  const allowed = ['AUTO', 'DAY', 'MONTH', 'YEAR'].includes(requested);
  if (!allowed) throw invalidInputException();
  if (period === 'WEEK' && requested !== 'AUTO' && requested !== 'DAY')
    throw invalidInputException();
  if (period === 'MONTH' && !['AUTO', 'DAY', 'MONTH'].includes(requested))
    throw invalidInputException();
  if (period === 'ALL' && requested !== 'AUTO' && requested !== 'YEAR')
    throw invalidInputException();

  if (requested !== 'AUTO') return requested;
  if (period === 'WEEK' || period === 'MONTH') return 'DAY';
  if (period === 'YEAR') return 'MONTH';
  if (period === 'ALL') return 'YEAR';

  const dayCount = fromDate.until(toDate, { largestUnit: 'day' }).days + 1;
  if (dayCount <= 93) return 'DAY';
  if (Temporal.PlainDate.compare(toDate, fromDate.add({ months: 36 })) <= 0)
    return 'MONTH';
  return 'YEAR';
}

function countPeriods(
  fromDate: Temporal.PlainDate,
  toDate: Temporal.PlainDate,
  granularity: ResolvedStatisticsGranularity,
): number {
  if (granularity === 'DAY')
    return fromDate.until(toDate, { largestUnit: 'day' }).days + 1;
  if (granularity === 'MONTH')
    return (
      (toDate.year - fromDate.year) * 12 + toDate.month - fromDate.month + 1
    );
  return toDate.year - fromDate.year + 1;
}

function startOfLocalDate(date: Temporal.PlainDate, timezone: string): Date {
  const instant = date
    .toZonedDateTime({
      timeZone: timezone,
      plainTime: Temporal.PlainTime.from('00:00'),
    })
    .toInstant();
  return new Date(instant.epochMilliseconds);
}

function isPeriod(value: unknown): value is StatisticsPeriod {
  return ['WEEK', 'MONTH', 'YEAR', 'ALL', 'RANGE'].includes(value as string);
}

function validateParameterCombination(
  query: StatisticsDateRangeQuery,
): StatisticsPeriod {
  if (!isPeriod(query.period)) throw invalidInputException();
  const { period, anchorDate, fromDate, toDate } = query;
  const hasAnchor = anchorDate !== undefined;
  const hasFromDate = fromDate !== undefined;
  const hasToDate = toDate !== undefined;
  if (period === 'WEEK' || period === 'MONTH' || period === 'YEAR') {
    if (!hasAnchor || hasFromDate || hasToDate) throw invalidInputException();
  } else if (period === 'RANGE') {
    if (hasAnchor || !hasFromDate || !hasToDate) throw invalidInputException();
  } else if (hasAnchor || hasFromDate || hasToDate) {
    throw invalidInputException();
  }
  return period;
}

export function resolveStatisticsDateRange(
  query: StatisticsDateRangeQuery,
  timezone: string,
  options: StatisticsDateRangeOptions = {},
): StatisticsDateRange {
  if (!isLedgerTimezone(timezone)) throw invalidInputException();
  const period = validateParameterCombination(query);
  const today =
    options.today === undefined
      ? Temporal.Now.plainDateISO(timezone)
      : parsePlainDate(options.today);
  let fromDate: Temporal.PlainDate | null;
  let toDate: Temporal.PlainDate = today;

  if (period === 'ALL') {
    const granularity = resolveGranularity(query, period, today, today);
    if (options.allStartDate === undefined) {
      return {
        period,
        timezone,
        fromDate: null,
        toDate: null,
        startAt: null,
        endAt: null,
        granularity,
      };
    }
    fromDate = parsePlainDate(options.allStartDate);
    if (Temporal.PlainDate.compare(fromDate, today) > 0) fromDate = null;
  } else if (period === 'RANGE') {
    fromDate = parsePlainDate(query.fromDate);
    toDate = parsePlainDate(query.toDate);
    if (
      Temporal.PlainDate.compare(toDate, today) > 0 ||
      Temporal.PlainDate.compare(toDate, fromDate) < 0
    ) {
      throw invalidInputException();
    }
    if (
      fromDate.until(toDate, { largestUnit: 'day' }).days + 1 >
      maximumRangeDays
    ) {
      throw rangeTooBroadException();
    }
  } else {
    const anchorDate = parsePlainDate(query.anchorDate);
    if (Temporal.PlainDate.compare(anchorDate, today) > 0)
      throw invalidInputException();
    if (period === 'WEEK') {
      fromDate = anchorDate.subtract({ days: anchorDate.dayOfWeek - 1 });
      toDate = fromDate.add({ days: 6 });
    } else if (period === 'MONTH') {
      fromDate = anchorDate.with({ day: 1 });
      toDate = fromDate.add({ months: 1 }).subtract({ days: 1 });
    } else {
      fromDate = Temporal.PlainDate.from({
        year: anchorDate.year,
        month: 1,
        day: 1,
      });
      toDate = Temporal.PlainDate.from({
        year: anchorDate.year,
        month: 12,
        day: 31,
      });
    }
  }

  if (fromDate === null) {
    return {
      period,
      timezone,
      fromDate: null,
      toDate: null,
      startAt: null,
      endAt: null,
      granularity: resolveGranularity(query, period, today, today),
    };
  }

  const granularity = resolveGranularity(query, period, fromDate, toDate);
  if (
    countPeriods(fromDate, toDate, granularity) > maximumPeriods[granularity]
  ) {
    throw rangeTooBroadException();
  }

  return {
    period,
    timezone,
    fromDate: fromDate.toString(),
    toDate: toDate.toString(),
    startAt: startOfLocalDate(fromDate, timezone).toISOString(),
    endAt: startOfLocalDate(toDate.add({ days: 1 }), timezone).toISOString(),
    granularity,
  };
}
