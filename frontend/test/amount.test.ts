import assert from 'node:assert/strict';
import { formatCentsToYuan } from '../src/lib/utils';

// 测试基础转换
assert.equal(formatCentsToYuan(0), '0.00');
assert.equal(formatCentsToYuan(1), '0.01');
assert.equal(formatCentsToYuan(9), '0.09');
assert.equal(formatCentsToYuan(10), '0.10');
assert.equal(formatCentsToYuan(99), '0.99');
assert.equal(formatCentsToYuan(100), '1.00');
assert.equal(formatCentsToYuan(1250), '12.50');

// 测试千分符与大额
assert.equal(formatCentsToYuan(100000), '1,000.00');
assert.equal(formatCentsToYuan(123456789), '1,234,567.89');

// 测试不使用千分符
assert.equal(formatCentsToYuan(123456789, { useGrouping: false }), '1234567.89');

// 测试负数
assert.equal(formatCentsToYuan(-50), '-0.50');
assert.equal(formatCentsToYuan(-1250), '-12.50');
assert.equal(formatCentsToYuan(-100000), '-1,000.00');

// 测试正号显式显示
assert.equal(formatCentsToYuan(1250, { showSign: true }), '+12.50');
assert.equal(formatCentsToYuan(0, { showSign: true }), '0.00');
assert.equal(formatCentsToYuan(-1250, { showSign: true }), '-12.50');

// 测试边界浮点转整分传入保护
assert.equal(formatCentsToYuan(199.9), '2.00');
assert.equal(formatCentsToYuan(Number.NaN), '0.00');

console.log('amount format contract tests passed');

