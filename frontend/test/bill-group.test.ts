import assert from 'node:assert/strict';
import { groupBillsByDay, billSecondaryText, formatBillTime } from '../src/lib/bill/bill-group';
import type { TransactionSummary } from '../src/lib/api/transaction-types';

function bill(overrides: Partial<TransactionSummary> & { id: string; occurredAt: string }): TransactionSummary {
  return {
    ledgerId: 'ledger-1',
    type: 'EXPENSE',
    amountCents: 1000,
    title: null,
    note: null,
    categoryId: 'category-1',
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    transferGroupId: null,
    source: 'MANUAL',
    clientRequestId: `req-${overrides.id}`,
    createdById: 'user-1',
    updatedById: 'user-1',
    payerId: null,
    version: 1,
    deletedAt: null,
    createdAt: overrides.occurredAt,
    updatedAt: overrides.occurredAt,
    category: { id: 'category-1', type: 'EXPENSE', name: '餐饮' },
    account: null,
    payer: null,
    ...overrides,
  };
}

const now = new Date('2026-11-03T12:00:00+08:00');

// 同一账本日的多笔账单进入同一分组，组内按发生时间倒序。
const sameDay = groupBillsByDay(
  [
    bill({ id: 'a', occurredAt: '2026-11-02T02:00:00.000Z', amountCents: 1680 }),
    bill({ id: 'b', occurredAt: '2026-11-02T09:00:00.000Z', amountCents: 2000 }),
  ],
  { now },
);
assert.equal(sameDay.length, 1);
assert.equal(sameDay[0].billDate, '2026-11-02');
assert.deepEqual(sameDay[0].items.map((item) => item.id), ['b', 'a']);
assert.equal(sameDay[0].expenseCents, 3680);
assert.equal(sameDay[0].incomeCents, 0);

// 跨 UTC 日界：UTC 16:00 已属账本时区的次日，必须分成两组且日期倒序。
const crossUtc = groupBillsByDay(
  [
    bill({ id: 'early', occurredAt: '2026-11-02T15:59:00.000Z' }),
    bill({ id: 'late', occurredAt: '2026-11-02T16:00:00.000Z' }),
  ],
  { now },
);
assert.deepEqual(crossUtc.map((group) => group.billDate), ['2026-11-03', '2026-11-02']);

// 收入与支出分别累计，互不混算。
const mixed = groupBillsByDay(
  [
    bill({ id: 'exp', occurredAt: '2026-11-02T02:00:00.000Z', type: 'EXPENSE', amountCents: 3500 }),
    bill({ id: 'inc', occurredAt: '2026-11-02T03:00:00.000Z', type: 'INCOME', amountCents: 10000 }),
  ],
  { now },
);
assert.equal(mixed[0].expenseCents, 3500);
assert.equal(mixed[0].incomeCents, 10000);

// 今天/昨天标记按账本时区判断，与设备时区无关。
const todayGroup = groupBillsByDay(
  [bill({ id: 'today', occurredAt: '2026-11-03T01:00:00.000Z' })],
  { now },
);
assert.equal(todayGroup[0].isToday, true);
assert.equal(todayGroup[0].isYesterday, false);
assert.equal(todayGroup[0].weekday, '星期二');

const yesterdayGroup = groupBillsByDay(
  [bill({ id: 'yesterday', occurredAt: '2026-11-02T01:00:00.000Z' })],
  { now },
);
assert.equal(yesterdayGroup[0].isYesterday, true);
assert.equal(yesterdayGroup[0].label, '11/02');

// 空列表不伪造分组。
assert.deepEqual(groupBillsByDay([], { now }), []);

// 跨年标签带年份，避免同年份混淆。
const crossYear = groupBillsByDay(
  [bill({ id: 'old', occurredAt: '2025-12-31T02:00:00.000Z' })],
  { now },
);
assert.equal(crossYear[0].label, '2025/12/31');

// 次级文案：优先商家，其次备注，都为空返回空串（页面不渲染占位）。
assert.equal(billSecondaryText(bill({ id: 'x', occurredAt: now.toISOString(), title: '晚饭', note: '好吃' })), '晚饭');
assert.equal(billSecondaryText(bill({ id: 'y', occurredAt: now.toISOString(), note: '好吃' })), '好吃');
assert.equal(billSecondaryText(bill({ id: 'z', occurredAt: now.toISOString() })), '');

// 时间按账本时区格式化。
assert.equal(formatBillTime('2026-11-02T14:20:00.000Z'), '22:20');

console.log('bill group contract passed');
