import assert from 'node:assert/strict';
import {
  allowedGranularities,
  canGoNext,
  formatAnchorLabel,
  mondayOf,
  monthEnd,
  shiftAnchor,
  spanDays,
  todayInZone,
} from '../src/lib/statistics/range';

// 自然周以周一为起点
assert.equal(mondayOf('2026-11-04'), '2026-11-02'); // 周三 → 周一
assert.equal(mondayOf('2026-11-02'), '2026-11-02'); // 周一 → 自身
assert.equal(mondayOf('2026-11-01'), '2026-10-26'); // 周日 → 上一个周一
assert.equal(mondayOf('2026-11-08'), '2026-11-02'); // 周日 → 同周周一

// 周平移
assert.equal(shiftAnchor('WEEK', '2026-11-04', 1), '2026-11-09');
assert.equal(shiftAnchor('WEEK', '2026-11-04', -1), '2026-10-26');
// 跨月跨年
assert.equal(shiftAnchor('WEEK', '2026-01-01', -1), '2025-12-22');

// 月平移，含跨年
assert.equal(shiftAnchor('MONTH', '2026-11-01', 1), '2026-12-01');
assert.equal(shiftAnchor('MONTH', '2026-12-01', 1), '2027-01-01');
assert.equal(shiftAnchor('MONTH', '2026-01-01', -1), '2025-12-01');
assert.equal(shiftAnchor('MONTH', '2026-11-30', 0), '2026-11-01');

// 年平移固定落 1 月 1 日，闰日不溢出
assert.equal(shiftAnchor('YEAR', '2026-01-01', 1), '2027-01-01');
assert.equal(shiftAnchor('YEAR', '2024-02-29', 1), '2025-01-01');

// ALL / RANGE 不导航
assert.equal(shiftAnchor('ALL', '2026-11-04', 1), '2026-11-04');
assert.equal(shiftAnchor('RANGE', '2026-11-04', 1), '2026-11-04');

// 未来周期不可进入
const today = '2026-11-04';
assert.equal(canGoNext('WEEK', '2026-10-26', today), true);
assert.equal(canGoNext('WEEK', '2026-11-02', today), false); // 当前周
assert.equal(canGoNext('MONTH', '2026-10-01', today), true);
assert.equal(canGoNext('MONTH', '2026-11-01', today), false); // 当前月
assert.equal(canGoNext('YEAR', '2025-01-01', today), true);
assert.equal(canGoNext('YEAR', '2026-01-01', today), false); // 当前年
assert.equal(canGoNext('ALL', '2026-11-04', today), false); // 无翻页
assert.equal(canGoNext('RANGE', '2026-11-04', today), false);

// 导航文案
assert.equal(formatAnchorLabel('MONTH', '2026-11-01'), '2026年11月');
assert.equal(formatAnchorLabel('YEAR', '2026-01-01'), '2026年');
assert.equal(formatAnchorLabel('WEEK', '2026-11-04'), '11月2日 - 11月8日');

// 跨度计算：首尾均计入
assert.equal(spanDays('2026-11-01', '2026-11-01'), 1);
assert.equal(spanDays('2026-11-01', '2026-11-30'), 30);
assert.equal(spanDays('2026-01-01', '2026-12-31'), 365);

// 粒度可用性：与后端 AUTO 规则一致
assert.deepEqual(allowedGranularities(30), ['DAY', 'MONTH', 'YEAR']);
assert.deepEqual(allowedGranularities(500), ['MONTH', 'YEAR']);
assert.deepEqual(allowedGranularities(4000), ['YEAR']);

// 月末
assert.equal(monthEnd(2026, 11), '2026-11-30');
assert.equal(monthEnd(2026, 2), '2026-02-28');
assert.equal(monthEnd(2024, 2), '2024-02-29');

// 账本时区的今天：UTC 与 Asia/Shanghai 跨日时取后者
assert.equal(todayInZone(new Date('2026-11-03T16:30:00.000Z')), '2026-11-04');
assert.equal(todayInZone(new Date('2026-11-03T15:30:00.000Z')), '2026-11-03');

console.log('statistics range contract passed');
