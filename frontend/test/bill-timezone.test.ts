import assert from 'node:assert/strict';
import {
  LEDGER_TIME_ZONE,
  billDateOf,
  currentZonedMonth,
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

console.log('bill timezone contract passed');
