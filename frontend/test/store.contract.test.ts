import assert from 'node:assert/strict';
import { useAppStore } from '../src/store/useAppStore';

const ledger = {
  id: 'ledger-1',
  name: '家庭账本',
  type: 'SHARED' as const,
  defaultCurrency: 'CNY',
  role: 'OWNER' as const,
};

// 账本状态
useAppStore.setState({ activeLedger: null });
assert.equal(useAppStore.getState().activeLedger, null);

useAppStore.getState().setActiveLedger(ledger);
assert.deepEqual(useAppStore.getState().activeLedger, ledger);

console.log('store contract passed');
