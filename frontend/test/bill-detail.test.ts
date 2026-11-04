import assert from 'node:assert/strict';
import {
  buildMemberDirectory,
  resolveDetailPermissions,
  toBillDetailView,
} from '../src/lib/bill/bill-detail';
import type { TransactionSummary } from '../src/lib/api/transaction-types';
import type { LedgerMemberSummary } from '../src/lib/api/member-types';

const format = (iso: string): string => iso.slice(0, 16).replace('T', ' ');

function member(userId: string, nickname: string | null, username: string): LedgerMemberSummary {
  return {
    id: `m-${userId}`,
    ledgerId: 'ledger-1',
    userId,
    role: 'EDITOR',
    status: 'ACTIVE',
    joinedAt: '2026-11-01T00:00:00.000Z',
    user: { id: userId, username, nickname, avatar: null },
  };
}

function bill(overrides: Partial<TransactionSummary> = {}): TransactionSummary {
  return {
    id: 'bill-1',
    ledgerId: 'ledger-1',
    type: 'EXPENSE',
    amountCents: 1680,
    occurredAt: '2026-11-02T14:20:00.000Z',
    title: '晚饭',
    note: '和朋友',
    categoryId: 'cat-food',
    accountId: 'acc-1',
    fromAccountId: null,
    toAccountId: null,
    transferGroupId: null,
    source: 'MANUAL',
    clientRequestId: 'req-1',
    createdById: 'u1',
    updatedById: 'u2',
    payerId: null,
    version: 1,
    deletedAt: null,
    createdAt: '2026-11-02T14:21:00.000Z',
    updatedAt: '2026-11-03T01:12:00.000Z',
    category: { id: 'cat-food', type: 'EXPENSE', name: '餐饮', parentId: null },
    account: { id: 'acc-1', name: '微信', visibility: 'SHARED' },
    payer: null,
    ...overrides,
  };
}

const directory = buildMemberDirectory([
  member('u1', '小宝', 'xiaobao'),
  member('u2', null, 'baoge'),
]);

// 昵称为空时回退用户名，便于「最后修改」仍能显示具体人
assert.equal(directory.byId.get('u1'), '小宝');
assert.equal(directory.byId.get('u2'), 'baoge');

// 完整字段：金额带符号、四类事实 + 四项审计
const full = toBillDetailView(bill(), directory, format);
assert.equal(full.isExpense, true);
assert.equal(full.signedAmount, '-¥16.80');
assert.equal(full.categoryName, '餐饮');
assert.deepEqual(
  full.facts.map((item) => item.label),
  ['发生时间', '账户', '商家/对象', '备注'],
);
assert.equal(full.facts[0].value, '2026-11-02 14:20');
assert.deepEqual(
  full.audit.map((item) => item.value),
  ['小宝', 'baoge', '2026-11-02 14:21', '2026-11-03 01:12'],
);

// 空字段不渲染占位行
const sparse = toBillDetailView(
  bill({ title: null, note: '   ', account: null, accountId: null }),
  directory,
  format,
);
assert.deepEqual(sparse.facts.map((item) => item.label), ['发生时间']);

// 收入：金额带 +，且不显示付款人
const income = toBillDetailView(
  bill({ type: 'INCOME', amountCents: 500000, payerId: 'u2' }),
  directory,
  format,
);
assert.equal(income.isExpense, false);
// 金额复用 formatCentsToYuan，默认带千分位
assert.equal(income.signedAmount, '+¥5,000.00');
assert.ok(!income.facts.some((item) => item.label === '实际付款人'));

// 支出有付款人时展示；payer.nickname 为空则回退成员表
const withPayer = toBillDetailView(
  bill({ payerId: 'u2', payer: { id: 'u2', nickname: null } }),
  directory,
  format,
);
assert.equal(withPayer.facts.find((item) => item.label === '实际付款人')?.value, 'baoge');

// 查不到的成员显示「未知成员」，不崩溃
const unknown = toBillDetailView(bill({ createdById: 'ghost' }), directory, format);
assert.equal(unknown.audit[0].value, '未知成员');

// 权限矩阵
assert.deepEqual(resolveDetailPermissions('VIEWER', bill(), 'u1'), { canEdit: false, canDelete: false });
assert.deepEqual(resolveDetailPermissions(undefined, bill(), 'u1'), { canEdit: false, canDelete: false });
assert.deepEqual(resolveDetailPermissions('OWNER', bill(), 'u1'), { canEdit: true, canDelete: true });
// EDITOR 只能删自己创建的
assert.deepEqual(resolveDetailPermissions('EDITOR', bill(), 'u1'), { canEdit: true, canDelete: true });
assert.deepEqual(resolveDetailPermissions('EDITOR', bill(), 'u2'), { canEdit: true, canDelete: false });
// 未登录时不算自己的账单
assert.deepEqual(resolveDetailPermissions('EDITOR', bill(), null), { canEdit: true, canDelete: false });

console.log('bill detail contract passed');
