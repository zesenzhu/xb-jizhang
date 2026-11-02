import assert from 'node:assert/strict';
import {
  queryKeys,
  queryStaleTime,
} from '../src/lib/query/query-config';

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
assert.equal(queryStaleTime.transactions, 30 * 1000);

console.log('query config contract passed');
