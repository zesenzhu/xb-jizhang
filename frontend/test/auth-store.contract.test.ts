import assert from 'node:assert/strict';
import { useAdminAuthStore } from '../src/store/adminAuthStore';
import { useUserAuthStore } from '../src/store/userAuthStore';

const user = {
  id: 'user-1',
  username: 'xiaobao',
  nickname: null,
  email: null,
  avatar: null,
  isActive: true,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};
const admin = {
  id: 'admin-1',
  username: 'operator',
  displayName: '运营管理员',
  isActive: true,
  roles: ['OPERATOR'],
  permissions: ['user:read'],
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
  lastLoginAt: null,
};

useUserAuthStore.getState().clear();
useAdminAuthStore.getState().clear();
useUserAuthStore.getState().setCurrentUser(user);
useAdminAuthStore.getState().setCurrentAdmin(admin);

assert.equal(useUserAuthStore.getState().currentUser?.id, 'user-1');
assert.equal(useAdminAuthStore.getState().currentAdmin?.id, 'admin-1');

useUserAuthStore.getState().clear();
assert.equal(useUserAuthStore.getState().status, 'unauthenticated');
assert.equal(useAdminAuthStore.getState().status, 'authenticated');
assert.equal(useAdminAuthStore.getState().currentAdmin?.id, 'admin-1');

console.log('auth store contract passed');
