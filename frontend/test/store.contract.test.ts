import assert from 'node:assert/strict';
import { useAppStore } from '../src/store/useAppStore';
import './routes.contract.test';
import './auth-store.contract.test';
import './api-client.contract.test';
import './auth-api.contract.test';
import './client-state.contract.test';

const ledger = {
  id: 'ledger-1',
  name: '家庭账本',
  type: 'SHARED' as const,
  role: 'OWNER' as const,
};

useAppStore.setState({ activeLedger: null });
assert.equal(useAppStore.getState().activeLedger, null);

useAppStore.getState().setActiveLedger(ledger);
assert.deepEqual(useAppStore.getState().activeLedger, ledger);

console.log('store contract passed');
