import assert from 'node:assert/strict';
import {
  AMOUNT_MAX_LENGTH,
  amountTextFromCents,
  applyAmountKey,
  parseAmountText,
} from '../src/lib/bill/amount';

// 正常输入转整数分
assert.deepEqual(parseAmountText('12'), { cents: 1200, error: null });
assert.deepEqual(parseAmountText('12.5'), { cents: 1250, error: null });
assert.deepEqual(parseAmountText('12.50'), { cents: 1250, error: null });
assert.deepEqual(parseAmountText('0.01'), { cents: 1, error: null });
assert.deepEqual(parseAmountText('1234.56'), { cents: 123456, error: null });

// 空值与零不可提交
assert.equal(parseAmountText('').cents, null);
assert.equal(parseAmountText('0').error, '请输入金额');
assert.equal(parseAmountText('0.').cents, null);
assert.equal(parseAmountText('0.00').error, '请输入大于 0 的金额');

// 三位小数与非法字符拒绝
assert.equal(parseAmountText('12.505').error, '金额最多支持两位小数');
assert.equal(parseAmountText('1.2.3').cents, null);
assert.equal(parseAmountText('abc').cents, null);
assert.equal(parseAmountText('-5').cents, null);
assert.equal(parseAmountText('1e3').cents, null);

// 浮点误差：0.1 + 0.2 一类输入必须精确
assert.deepEqual(parseAmountText('0.1'), { cents: 10, error: null });
assert.deepEqual(parseAmountText('0.29'), { cents: 29, error: null });
assert.deepEqual(parseAmountText('8.11'), { cents: 811, error: null });

// 回填
assert.equal(amountTextFromCents(1250), '12.50');
assert.equal(amountTextFromCents(1), '0.01');
assert.equal(amountTextFromCents(0), '0');
assert.equal(amountTextFromCents(123456), '1234.56');

// 往返一致性
for (const text of ['0.01', '1.05', '99.99', '1234.56']) {
  const cents = parseAmountText(text).cents;
  assert.equal(amountTextFromCents(cents as number), text);
}

// 键盘累积：同一批次连点必须全部生效（回归：连点 888 曾只剩一个 8）
let typed = '0';
for (const key of ['8', '8', '.', '8'] as const) typed = applyAmountKey(typed, key);
assert.equal(typed, '88.8');
assert.equal(parseAmountText(typed).cents, 8880);

// 前导零被替换，单个 0 不会累积成 00
assert.equal(applyAmountKey('0', '0'), '0');
assert.equal(applyAmountKey('0', '5'), '5');

// 小数点只出现一次
assert.equal(applyAmountKey('12.3', '.'), '12.3');

// 第三位小数被拒
assert.equal(applyAmountKey('12.34', '5'), '12.34');

// 退格与清空
assert.equal(applyAmountKey('12.34', 'BACKSPACE'), '12.3');
assert.equal(applyAmountKey('5', 'BACKSPACE'), '0');
assert.equal(applyAmountKey('0', 'BACKSPACE'), '0');
assert.equal(applyAmountKey('99.99', 'CLEAR'), '0');

// 长度上限
const long = '1'.repeat(AMOUNT_MAX_LENGTH);
assert.equal(applyAmountKey(long, '9'), long);

// 从空串起手打小数
assert.equal(applyAmountKey('', '.'), '0.');

console.log('bill amount contract passed');
