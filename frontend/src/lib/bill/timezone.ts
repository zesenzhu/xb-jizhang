/**
 * 一期账本时区固定为 Asia/Shanghai。
 *
 * 后端 Ledger 尚无 timezone 字段（缺口 B3），这里先收敛成单一常量：
 * 后端补齐后，把 `LEDGER_TIME_ZONE` 换成 `ledger.timezone` 即可，
 * 其余调用点不需要改动，也不允许各页面自行硬编码时区字符串。
 */
export const LEDGER_TIME_ZONE = 'Asia/Shanghai';

/** 账本时区下的账单日（YYYY-MM-DD）。日期分组与月度边界都以它为准。 */
export function billDateOf(occurredAt: string, timeZone: string = LEDGER_TIME_ZONE): string {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return '';

  // en-CA 的短日期格式固定输出 YYYY-MM-DD，避免手工拼接时区偏移。
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * 把账本时区的某个日历时刻转成 UTC ISO 字符串。
 * `month` 为 1-12；当 month 为 13 时自动进位到下一年 1 月。
 */
export function zonedMonthBoundary(
  year: number,
  month: number,
  timeZone: string = LEDGER_TIME_ZONE,
): string {
  const normalizedYear = month > 12 ? year + 1 : year;
  const normalizedMonth = month > 12 ? 1 : month;
  const offsetMinutes = timeZoneOffsetMinutes(normalizedYear, normalizedMonth, timeZone);
  const utcMs =
    Date.UTC(normalizedYear, normalizedMonth - 1, 1, 0, 0, 0) - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * 取目标时区在指定年月 1 日的 UTC 偏移（分钟）。
 * 用“把该时刻按 UTC 解释再与目标时区解释求差”的方式计算，避免依赖运行环境时区。
 */
function timeZoneOffsetMinutes(year: number, month: number, timeZone: string): number {
  const utcLike = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcLike));

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asZoned = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second'),
  );
  return Math.round((asZoned - utcLike) / 60000);
}

/** 账本时区下当前年月（1-12）。 */
export function currentZonedMonth(
  now: Date = new Date(),
  timeZone: string = LEDGER_TIME_ZONE,
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read('year'), month: read('month') };
}

/**
 * 账本时区下的完整日期时间，如 `2026-11-02 22:20`。
 *
 * 详情页要区分「发生时间」和「创建时间」，两者都需要日期；
 * 与 `billDateOf` 不同，这里保留时:分，且用同一时区，
 * 避免跨时区用户看到发生时间在 11-02、创建时间却在 11-03 的错位。
 */
export function formatBillDateTime(
  iso: string,
  timeZone: string = LEDGER_TIME_ZONE,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
