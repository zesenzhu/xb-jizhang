import assert from 'node:assert/strict';
import type { UserSummary } from '../src/lib/api/auth-types';
import type { AccountSummary } from '../src/lib/api/account-types';
import type { CategorySummary } from '../src/lib/api/category-types';
import { createOfflineTransactionRecord, matchesTransactionQuery, toLocalTransactionSummary } from '../src/lib/offline/local-transaction';

const user: UserSummary = {
  id: 'user-1',
  username: 'xiaobao',
  nickname: '小宝',
  email: null,
  avatar: null,
  isActive: true,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

const category: CategorySummary = {
  id: 'category-1',
  ledgerId: 'ledger-1',
  type: 'EXPENSE',
  name: '餐饮',
  icon: null,
  color: null,
  sortOrder: 1,
  isSystem: true,
  isActive: true,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  parentId: null,
};

const account: AccountSummary = {
  id: 'account-1',
  ledgerId: 'ledger-1',
  ownerId: null,
  name: '现金',
  type: 'CASH',
  visibility: 'SHARED',
  initialBalanceCents: 0,
  currentBalanceCents: 0,
  includeInAssets: true,
  icon: null,
  color: null,
  isActive: true,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

const record = createOfflineTransactionRecord({
  localId: 'local-1',
  user,
  ledgerId: 'ledger-1',
  payload: {
    clientRequestId: 'request-1',
    type: 'EXPENSE',
    amountCents: 1250,
    occurredAt: '2026-11-10T08:00:00.000Z',
    categoryId: 'category-1',
    accountId: 'account-1',
    title: '早餐',
    note: '离线记录',
    payerId: null,
  },
  category,
  account,
  payer: null,
  attachments: [],
  now: '2026-11-10T08:01:00.000Z',
});

const summary = toLocalTransactionSummary(record);
assert.equal(record.clientRequestId, 'request-1');
assert.equal(summary.id, 'local:local-1');
assert.equal(summary.category?.name, '餐饮');
assert.equal(summary.account?.name, '现金');
assert.equal(matchesTransactionQuery(summary, { keyword: '离线' }), true);
assert.equal(matchesTransactionQuery(summary, { type: 'INCOME' }), false);
assert.equal(matchesTransactionQuery(summary, { from: '2026-11-11T00:00:00.000Z' }), false);

console.log('local transaction contract passed');
