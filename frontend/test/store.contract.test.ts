import assert from 'node:assert/strict';
import { useAppStore } from '../src/store/useAppStore';

useAppStore.setState({ isOnline: true });
assert.equal(useAppStore.getState().isOnline, true);
useAppStore.getState().setIsOnline(false);
assert.equal(useAppStore.getState().isOnline, false);

console.log('store contract passed');
