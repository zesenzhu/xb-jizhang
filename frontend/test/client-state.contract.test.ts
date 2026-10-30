import assert from 'node:assert/strict';
import { useOfflineStore } from '../src/store/offlineStore';
import { useWorkspaceStore } from '../src/store/workspaceStore';

useWorkspaceStore.getState().clear();
useWorkspaceStore.getState().setCurrentLedgerId('ledger-1');
assert.equal(useWorkspaceStore.getState().currentLedgerId, 'ledger-1');
useWorkspaceStore.getState().clear();
assert.equal(useWorkspaceStore.getState().currentLedgerId, null);

useOfflineStore.getState().setSyncState({ syncStatus: 'failed', pendingCount: 2, lastError: '网络不可用' });
assert.equal(useOfflineStore.getState().syncStatus, 'failed');
assert.equal(useOfflineStore.getState().pendingCount, 2);
assert.equal(useOfflineStore.getState().lastError, '网络不可用');
useOfflineStore.getState().setOnline(false);
assert.equal(useOfflineStore.getState().isOnline, false);

console.log('client state contract passed');
