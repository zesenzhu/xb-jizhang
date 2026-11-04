import assert from 'node:assert/strict';
import {
  queryKeys,
  queryStaleTime,
} from '../src/lib/query/query-config';
import { ApiRequestError } from '../src/lib/api/errors';
import { shouldRetryQuery } from '../src/components/providers/QueryProvider';

assert.deepEqual(queryKeys.ledgers.list({ page: 1, pageSize: 20 }), [
  'ledgers',
  'list',
  { page: 1, pageSize: 20 },
]);
assert.deepEqual(queryKeys.ledgers.detail('ledger-1'), ['ledgers', 'detail', 'ledger-1']);
assert.notDeepEqual(queryKeys.ledgers.detail('ledger-1'), queryKeys.ledgers.detail('ledger-2'));
assert.equal(queryStaleTime.currentUser, 5 * 60 * 1000);
assert.equal(queryStaleTime.ledgers, 60 * 1000);
assert.equal(queryStaleTime.accounts, 5 * 60 * 1000);
assert.equal(queryStaleTime.categories, 5 * 60 * 1000);
assert.equal(queryStaleTime.members, 5 * 60 * 1000);
assert.equal(queryStaleTime.transactions, 30 * 1000);
assert.deepEqual(queryKeys.members('ledger-1'), ['ledger', 'ledger-1', 'members']);

// 账单与统计的缓存键：首段必须是 'ledger'，否则退出登录时清不掉上个用户的缓存。
assert.deepEqual(
  queryKeys.transactions.list('ledger-1', { page: 1, type: 'EXPENSE' }),
  ['ledger', 'ledger-1', 'transactions', 'list', { page: 1, type: 'EXPENSE' }],
);
assert.equal(queryKeys.transactions.list('ledger-1', {})[0], 'ledger');
assert.deepEqual(queryKeys.transactions.all('ledger-1'), ['ledger', 'ledger-1', 'transactions']);

// 归一化：键序与空值都不影响最终缓存键，否则同一组筛选会命中不同缓存。
assert.deepEqual(
  queryKeys.transactions.list('ledger-1', { type: 'EXPENSE', page: 1 }),
  queryKeys.transactions.list('ledger-1', { page: 1, type: 'EXPENSE' }),
);
assert.deepEqual(
  queryKeys.transactions.list('ledger-1', { page: 1, keyword: undefined }),
  queryKeys.transactions.list('ledger-1', { page: 1 }),
);

assert.deepEqual(
  queryKeys.statistics.overview('ledger-1', { from: 'a', to: 'b', keyword: '早餐', payerId: 'user-2' }),
  ['ledger', 'ledger-1', 'statistics', 'overview', { from: 'a', to: 'b', keyword: '早餐', payerId: 'user-2' }],
);
assert.deepEqual(
  queryKeys.statistics.overview('ledger-1', { to: 'b', from: 'a', type: undefined }),
  queryKeys.statistics.overview('ledger-1', { from: 'a', to: 'b' }),
);

assert.equal(shouldRetryQuery(0, new ApiRequestError({
  success: false,
  code: 40101,
  message: '登录状态已失效',
  data: null,
}, 401)), false);
assert.equal(shouldRetryQuery(0, new Error('网络暂时不可用')), true);
assert.equal(shouldRetryQuery(1, new Error('网络暂时不可用')), false);

console.log('query config contract passed');
