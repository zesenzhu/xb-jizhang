import assert from 'node:assert/strict';
import {
  LEDGER_TIME_ZONE,
  billDateOf,
  currentZonedMonth,
  shiftDateString,
  zonedDayBoundary,
  zonedMonthBoundary,
} from '../src/lib/bill/timezone';

assert.equal(LEDGER_TIME_ZONE, 'Asia/Shanghai');

// 账本时区固定为 +08:00：UTC 15:59 仍是当天，UTC 16:00 已跨到次日。
assert.equal(billDateOf('2026-11-02T15:59:00.000Z'), '2026-11-02');
assert.equal(billDateOf('2026-11-02T16:00:00.000Z'), '2026-11-03');
assert.equal(billDateOf('2026-10-31T16:00:00.000Z'), '2026-11-01');
assert.equal(billDateOf('not-a-date'), '');

// 月份边界：11 月起点是 UTC 10-31T16:00Z。
assert.equal(zonedMonthBoundary(2026, 11), '2026-10-31T16:00:00.000Z');
assert.equal(zonedMonthBoundary(2026, 12), '2026-11-30T16:00:00.000Z');

// month=13 自动进位到次年 1 月，供「当月下界」计算使用。
assert.equal(zonedMonthBoundary(2026, 13), '2026-12-31T16:00:00.000Z');

// 反解验证：边界日期在账本时区应落在当月 1 日。
assert.equal(billDateOf(zonedMonthBoundary(2026, 11)), '2026-11-01');
assert.equal(billDateOf(zonedMonthBoundary(2026, 13)), '2027-01-01');

const now = currentZonedMonth(new Date('2026-11-03T20:00:00.000Z'));
assert.deepEqual(now, { year: 2026, month: 11 });

// 跨年边界：UTC 12-31T16:30Z 在账本时区已是次年 1 月 1 日。
const newYear = currentZonedMonth(new Date('2026-12-31T16:30:00.000Z'));
assert.deepEqual(newYear, { year: 2027, month: 1 });

// 日边界：账本时区（+08:00）的 11-01 00:00 等于 UTC 10-31T16:00Z。
assert.equal(zonedDayBoundary('2026-11-01'), '2026-10-31T16:00:00.000Z');
assert.equal(zonedDayBoundary('2026-11-02'), '2026-11-01T16:00:00.000Z');
assert.equal(billDateOf(zonedDayBoundary('2026-11-01')), '2026-11-01');

// 非法日期返回空串，调用方据此退回默认范围，而不是发出 1970 年的查询。
assert.equal(zonedDayBoundary(''), '');
assert.equal(zonedDayBoundary('2026-13-01'), '');

// 有夏令时的时区：纽约 2026-03-08 当天从 EST 切到 EDT，
// 日边界必须落在本地 00:00（UTC 05:00），不能按月初偏移算出 04:00。
assert.equal(zonedDayBoundary('2026-03-08', 'America/New_York'), '2026-03-08T05:00:00.000Z');
assert.equal(zonedDayBoundary('2026-03-09', 'America/New_York'), '2026-03-09T04:00:00.000Z');
assert.equal(
  billDateOf(zonedDayBoundary('2026-03-09', 'America/New_York'), 'America/New_York'),
  '2026-03-09',
);

// 日期平移：跨月、跨年、闰年都要正确。
assert.equal(shiftDateString('2026-11-30', 1), '2026-12-01');
assert.equal(shiftDateString('2026-12-31', 1), '2027-01-01');
assert.equal(shiftDateString('2026-01-01', -1), '2025-12-31');
assert.equal(shiftDateString('2028-02-28', 1), '2028-02-29');
assert.equal(shiftDateString('2026-02-28', 1), '2026-03-01');
assert.equal(shiftDateString('2026-11-01', 6), '2026-11-07');
assert.equal(shiftDateString('bad', 1), '');

console.log('bill timezone contract passed');
