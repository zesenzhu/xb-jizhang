import assert from 'node:assert/strict';
import { billFormReducer, createInitialBillForm, NOTE_MAX_LENGTH } from '../src/lib/bill/bill-form';

const base = createInitialBillForm(new Date('2026-11-04T10:00:00.000Z'), 'req-1');

// 初始状态：支出、金额 0、未选分类、不脏
assert.equal(base.type, 'EXPENSE');
assert.equal(base.amountText, '0');
assert.equal(base.categoryId, null);
assert.equal(base.isDirty, false);
assert.equal(base.clientRequestId, 'req-1');

// 切换类型必须清空分类（支出分类不可用于收入）
const withCategory = billFormReducer(base, { kind: 'setCategory', categoryId: 'cat-food' });
assert.equal(withCategory.categoryId, 'cat-food');
assert.equal(withCategory.isDirty, true);
const switched = billFormReducer(withCategory, { kind: 'setType', type: 'INCOME' });
assert.equal(switched.type, 'INCOME');
assert.equal(switched.categoryId, null);
assert.equal(switched.amountText, '0', '切换类型应保留金额');

// 同类型重复设置不产生新对象（避免多余渲染）
assert.equal(billFormReducer(withCategory, { kind: 'setType', type: 'EXPENSE' }), withCategory);

// 金额视为脏
const withAmount = billFormReducer(base, { kind: 'setAmount', amountText: '12.5' });
assert.equal(withAmount.isDirty, true);
assert.equal(billFormReducer(base, { kind: 'setAmount', amountText: '0' }).isDirty, false);

// 备注截断到上限
const longNote = 'x'.repeat(NOTE_MAX_LENGTH + 50);
const withNote = billFormReducer(base, { kind: 'setNote', note: longNote });
assert.equal(withNote.note.length, NOTE_MAX_LENGTH);

// 保存并继续：清空金额/商家/备注，保留类型/时间/分类/账户/付款人，换新幂等键
const filled = {
  ...base,
  type: 'INCOME' as const,
  amountText: '88.80',
  categoryId: 'cat-salary',
  accountId: 'acc-1',
  payerId: 'user-2',
  title: '工资',
  note: '十一月',
};
const next = billFormReducer(filled, {
  kind: 'resetForNext',
  clientRequestId: 'req-2',
  occurredAt: '2026-11-04T11:00:00.000Z',
});
assert.equal(next.amountText, '0');
assert.equal(next.title, '');
assert.equal(next.note, '');
assert.equal(next.type, 'INCOME');
assert.equal(next.categoryId, 'cat-salary');
assert.equal(next.accountId, 'acc-1');
assert.equal(next.payerId, 'user-2');
assert.equal(next.clientRequestId, 'req-2');
assert.equal(next.occurredAt, '2026-11-04T11:00:00.000Z');
assert.equal(next.isDirty, false);

// 提交态
assert.equal(billFormReducer(filled, { kind: 'submitStart' }).submitting, true);
const failed = billFormReducer(billFormReducer(filled, { kind: 'submitStart' }), {
  kind: 'submitFailure',
  error: '保存失败',
});
assert.equal(failed.submitting, false);
assert.equal(failed.error, '保存失败');
assert.equal(failed.amountText, '88.80', '失败后必须保留输入');

// 时间校验结果随 setOccurredAt 写入
const future = billFormReducer(base, {
  kind: 'setOccurredAt',
  occurredAt: '2030-01-01T00:00:00.000Z',
  timeError: '不能记未来的账',
});
assert.equal(future.timeError, '不能记未来的账');
const past = billFormReducer(future, {
  kind: 'setOccurredAt',
  occurredAt: '2026-11-01T00:00:00.000Z',
  timeError: null,
});
assert.equal(past.timeError, null);

// 重新打开抽屉：上一次放弃的草稿必须彻底清空
const draft = {
  ...base,
  amountText: '99.99',
  categoryId: 'cat-food',
  accountId: 'acc-1',
  title: '残留',
  note: '残留备注',
  error: '请选择分类',
  timeError: '不能记未来的账',
  submitting: true,
};
const reopened = billFormReducer(draft, { kind: 'reset', now: new Date('2026-11-04T12:00:00.000Z') });
assert.equal(reopened.amountText, '0');
assert.equal(reopened.categoryId, null);
assert.equal(reopened.accountId, null);
assert.equal(reopened.title, '');
assert.equal(reopened.note, '');
assert.equal(reopened.error, null);
assert.equal(reopened.timeError, null);
assert.equal(reopened.submitting, false);
assert.equal(reopened.isDirty, false);
assert.equal(reopened.occurredAt, '2026-11-04T12:00:00.000Z');
assert.notEqual(reopened.clientRequestId, draft.clientRequestId, '重开必须换新幂等键');

console.log('bill form contract passed');
