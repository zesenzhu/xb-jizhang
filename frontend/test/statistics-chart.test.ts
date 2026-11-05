import assert from 'node:assert/strict';
import {
  formatCompactYuan,
  formatPercentage,
  formatPeriodLabel,
  hasNegative,
  toDonutSegments,
  toTrendPoints,
} from '../src/lib/statistics/chart';

// 趋势归一：最大值占满 100%，其余按比例
assert.deepEqual(toTrendPoints([100, 50, 0]), [
  { heightPercent: 100, isEmpty: false },
  { heightPercent: 50, isEmpty: false },
  { heightPercent: 0, isEmpty: true },
]);

// 全零：不虚构高度
assert.deepEqual(toTrendPoints([0, 0, 0]), [
  { heightPercent: 0, isEmpty: true },
  { heightPercent: 0, isEmpty: true },
  { heightPercent: 0, isEmpty: true },
]);

// 空数组
assert.deepEqual(toTrendPoints([]), []);

// 负值按绝对值缩放（结余为负时仍能画出来）
assert.deepEqual(toTrendPoints([-200, 100]).map((p) => p.heightPercent), [100, 50]);
assert.equal(hasNegative([-1, 2]), true);
assert.equal(hasNegative([0, 2]), false);

// 环形图：按总和归一并累计偏移
const segments = toDonutSegments([70, 30]);
assert.equal(segments.length, 2);
assert.equal(segments[0].offset, 0);
assert.equal(segments[0].ratio, 0.7);
assert.equal(segments[1].offset, 0.7);
assert.equal(segments[1].ratio, 0.3);

// 百分比总和不为 100 时仍闭合成整圆
const rounded = toDonutSegments([33.33, 33.33, 33.34]);
assert.equal(rounded.reduce((sum, s) => sum + s.ratio, 0), 1);

// 全零：无扇区
assert.deepEqual(toDonutSegments([0, 0]), []);

// 百分比格式
assert.equal(formatPercentage(69.9812), '69.98%');
assert.equal(formatPercentage(100), '100%');
assert.equal(formatPercentage(0), '0%');

// 周期标签
assert.equal(formatPeriodLabel('2026-11-01', '2026-11-01', 'DAY'), '11月1日');
assert.equal(formatPeriodLabel('2026-11-01', '2026-11-30', 'MONTH'), '2026年11月');
assert.equal(formatPeriodLabel('2026-01-01', '2026-12-31', 'YEAR'), '2026年');
// 首尾部分周期：显示实际起止
assert.equal(formatPeriodLabel('2026-11-15', '2026-11-30', 'DAY'), '11月15日 - 30日');
assert.equal(formatPeriodLabel('2026-11-15', '2026-12-31', 'DAY'), '11月15日 - 12月31日');

// 紧凑金额
assert.equal(formatCompactYuan(0), '0');
assert.equal(formatCompactYuan(12500), '125');
assert.equal(formatCompactYuan(1_500_000), '1.5万');
// 参数单位是分：250_000_000 分 = 250 万元
assert.equal(formatCompactYuan(250_000_000), '250.0万');
// 1 亿元 = 10_000_000_000 分
assert.equal(formatCompactYuan(10_000_000_000), '1.0亿');
assert.equal(formatCompactYuan(-1_500_000), '-1.5万');

console.log('statistics chart contract passed');
