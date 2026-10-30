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

// 初始认证状态
assert.equal(useAppStore.getState().isAuthenticated, false);
assert.equal(useAppStore.getState().user, null);

// 设置用户登录画像
const sampleUser = {
  id: 'user-001',
  username: 'xiaobao',
  nickname: '小宝',
  email: 'xiaobao@test.com',
  avatar: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

useAppStore.getState().setUser(sampleUser);
assert.equal(useAppStore.getState().isAuthenticated, true);
assert.deepEqual(useAppStore.getState().user, sampleUser);

// 清空用户画像
useAppStore.getState().setUser(null);
assert.equal(useAppStore.getState().isAuthenticated, false);
assert.equal(useAppStore.getState().user, null);

console.log('store contract passed');
