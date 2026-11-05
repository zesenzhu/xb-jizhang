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

/**
 * 某个 UTC 时刻在目标时区的偏移（分钟）。
 * 与 `timeZoneOffsetMinutes` 的区别：后者固定取「该月 1 日 00:00 UTC」的时刻，
 * 有夏令时的时区里，月中与月初的偏移可能差一小时。
 */
function offsetMinutesAt(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
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
  return Math.round((asZoned - utcMs) / 60000);
}

/**
 * 把账本时区下的某个本地日期（`YYYY-MM-DD`）的 00:00 转成 UTC ISO 字符串。
 *
 * 直接 `new Date('2026-11-01')` 会按 UTC 解释，在 +08:00 的账本时区里会差 8 小时；
 * 这里显式取该时刻的时区偏移，保证账单列表的日边界与统计服务端 `[startAt, endAt)` 一致。
 * 偏移要迭代两次：第一次猜一个近似时刻，第二次按真实时刻的偏移修正，
 * 这样夏令时切换日也落在正确的本地 00:00 上。
 */
export function zonedDayBoundary(date: string, timeZone: string = LEDGER_TIME_ZONE): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const year = Number(match?.[1] ?? 0);
  const month = Number(match?.[2] ?? 0);
  const day = Number(match?.[3] ?? 0);
  if (!match || !year || !month || !day) return '';

  // 正则只保证「四位数字」，13 月、32 日这类值会被 Date.UTC 静默滚动到下一月，
  // 所以必须显式校验范围，否则错误的日期会变成一条看似合法却偏移的查询区间。
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const localAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  if (new Date(localAsUtc).getUTCDate() !== day) return '';
  const firstGuess = localAsUtc - offsetMinutesAt(localAsUtc, timeZone) * 60 * 1000;
  const utcMs = localAsUtc - offsetMinutesAt(firstGuess, timeZone) * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * 本地日期字符串加减天数，用于把「结束日（含）」翻成半开区间的次日边界。
 *
 * 用 `Date.UTC` 构造再累加，避免 `Date` 在夏令时切换日按 23/25 小时推进导致跳日。
 */
export function shiftDateString(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';
  const shifted = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + days * 86_400_000,
  );
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
