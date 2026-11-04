import assert from 'node:assert/strict';
import {
  clearBillFilter,
  createInitialBillFilter,
  getBillFilterChips,
  isBillFilterActive,
  removeBillFilter,
  submitBillKeyword,
  toBillFilterQuery,
} from '../src/lib/bill/bill-filters';

const initial = createInitialBillFilter();

assert.deepEqual(initial, { keyword: '', payerId: '' });
assert.deepEqual(submitBillKeyword(initial, '  早餐  '), { keyword: '早餐', payerId: '' });
assert.deepEqual(submitBillKeyword({ keyword: '早餐', payerId: 'user-2' }, '  '), {
  keyword: '',
  payerId: 'user-2',
});
assert.deepEqual(getBillFilterChips({ keyword: '早餐', payerId: 'user-2' }, [{ id: 'user-2', name: '小宝' }]), [
  { key: 'keyword', label: '关键词：早餐' },
  { key: 'payerId', label: '付款人：小宝' },
]);
assert.deepEqual(clearBillFilter({ keyword: '早餐', payerId: 'user-2' }), initial);
assert.equal(isBillFilterActive(initial), false);
assert.equal(isBillFilterActive({ keyword: '早餐', payerId: '' }), true);
assert.deepEqual(removeBillFilter({ keyword: '早餐', payerId: 'user-2' }, 'keyword'), {
  keyword: '',
  payerId: 'user-2',
});
assert.deepEqual(toBillFilterQuery({ keyword: '早餐', payerId: 'user-2' }), {
  keyword: '早餐',
  payerId: 'user-2',
});
assert.deepEqual(toBillFilterQuery(initial), {});

console.log('bill filters contract passed');
