import type {
  StatisticsGranularity,
  StatisticsPeriod,
} from '@/lib/api/statistics-types';
import { LEDGER_TIME_ZONE } from '@/lib/bill/timezone';

/**
 * 统计页的时间导航计算。
 *
 * 全部按账本时区的本地日期（`YYYY-MM-DD`）计算，不碰 UTC 时间戳：
 * 服务端用 `anchorDate`/`fromDate`/`toDate` 解释自然周、自然月，
 * 前端只要给出正确的本地日期即可，绝不自行换算时区边界。
 */

/** 账本时区下的今天（`YYYY-MM-DD`）。 */
export function todayInZone(
  now: Date = new Date(),
  timeZone: string = LEDGER_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parse(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function format(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 某月的天数。用 UTC 构造避免宿主时区影响。 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 该日期所在自然周的周一（周一为一周起点，与需求 9.2 一致）。 */
export function mondayOf(date: string): string {
  const { year, month, day } = parse(date);
  const utc = Date.UTC(year, month - 1, day);
  // getUTCDay: 0=周日 … 6=周六；换算成「距周一的天数」
  const weekday = new Date(utc).getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(utc - offset * 86_400_000);
  return format(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
  );
}

/**
 * 按维度平移一个周期。
 *
 * `delta` 为 -1 或 +1；`ALL` 不导航，原样返回。
 * 返回值仍作为 `anchorDate` 交给服务端，前端不据此裁剪范围。
 */
export function shiftAnchor(
  period: StatisticsPeriod,
  anchorDate: string,
  delta: number,
): string {
  if (period === 'ALL' || period === 'RANGE') return anchorDate;

  if (period === 'WEEK') {
    const { year, month, day } = parse(mondayOf(anchorDate));
    const shifted = new Date(Date.UTC(year, month - 1, day) + delta * 7 * 86_400_000);
    return format(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
    );
  }

  const { year, month } = parse(anchorDate);

  if (period === 'MONTH') {
    const total = year * 12 + (month - 1) + delta;
    const nextYear = Math.floor(total / 12);
    const nextMonth = (total % 12 + 12) % 12 + 1;
    return format(nextYear, nextMonth, 1);
  }

  // YEAR：锚点固定为 1 月 1 日，避免 2 月 29 日跨年溢出
  return format(year + delta, 1, 1);
}

/**
 * 是否还能向后翻。
 *
 * 需求 9.2：不允许导航到未来统计周期。
 * - 周：当前周及之后不能翻
 * - 月：当前月及之后不能翻
 * - 年：当前年及之后不能翻
 * - ALL / RANGE：不提供翻页
 */
export function canGoNext(
  period: StatisticsPeriod,
  anchorDate: string,
  today: string,
): boolean {
  if (period === 'ALL' || period === 'RANGE') return false;
  if (period === 'WEEK') return mondayOf(anchorDate) < mondayOf(today);
  if (period === 'MONTH') {
    return anchorDate.slice(0, 7) < today.slice(0, 7);
  }
  return anchorDate.slice(0, 4) < today.slice(0, 4);
}

/** 时间导航中间的文案。 */
export function formatAnchorLabel(period: StatisticsPeriod, anchorDate: string): string {
  const { year, month, day } = parse(anchorDate);

  if (period === 'WEEK') {
    const monday = mondayOf(anchorDate);
    const start = parse(monday);
    const end = new Date(Date.UTC(start.year, start.month - 1, start.day) + 6 * 86_400_000);
    return `${start.month}月${start.day}日 - ${end.getUTCMonth() + 1}月${end.getUTCDate()}日`;
  }
  if (period === 'MONTH') return `${year}年${month}月`;
  if (period === 'YEAR') return `${year}年`;
  return '';
}

/**
 * 自定义范围允许的粒度。
 *
 * 与后端 4.3 的 AUTO 规则一致，用于决定汇总表格的粒度切换按钮是否可用；
 * 真正的裁剪仍在服务端（超限返回 40022）。
 */
export function allowedGranularities(spanDays: number): StatisticsGranularity[] {
  const options: StatisticsGranularity[] = [];
  if (spanDays <= 366) options.push('DAY');
  if (spanDays <= 120 * 31) options.push('MONTH');
  options.push('YEAR');
  return options;
}

/** 两个本地日期之间的自然日数量（首尾均计入）。 */
export function spanDays(fromDate: string, toDate: string): number {
  const from = parse(fromDate);
  const to = parse(toDate);
  const diff =
    Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
  return Math.round(diff / 86_400_000) + 1;
}

/** 某月最后一天，用于「范围」选择器的默认值。 */
export function monthEnd(year: number, month: number): string {
  return format(year, month, daysInMonth(year, month));
}
