import assert from 'node:assert/strict';
import { loginAdmin } from '../src/lib/api/admin-auth-api';
import { adminClient } from '../src/lib/api/admin-client';
import { loginUser } from '../src/lib/api/user-auth-api';
import { userClient } from '../src/lib/api/user-client';

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

void (async () => {
  const originalUserAdapter = userClient.defaults.adapter;
  const originalAdminAdapter = adminClient.defaults.adapter;
  let userRequest: { method?: string; url?: string; data?: unknown } | undefined;
  let adminRequest: { method?: string; url?: string; data?: unknown } | undefined;

  userClient.defaults.adapter = async (config) => {
    userRequest = config;
    return {
      data: { success: true, code: 0, message: '操作成功', data: { user, ledgers: [] } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  adminClient.defaults.adapter = async (config) => {
    adminRequest = config;
    return {
      data: { success: true, code: 0, message: '操作成功', data: admin },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  try {
    const userResult = await loginUser({ username: 'xiaobao', password: 'password' });
    const adminResult = await loginAdmin({ username: 'operator', password: 'password' });

    assert.equal(userResult.user.id, 'user-1');
    assert.equal(adminResult.id, 'admin-1');
    assert.equal(userRequest?.method, 'post');
    assert.equal(userRequest?.url, '/auth/login');
    assert.deepEqual(JSON.parse(String(userRequest?.data)), {
      username: 'xiaobao',
      password: 'password',
    });
    assert.equal(adminRequest?.method, 'post');
    assert.equal(adminRequest?.url, '/admin/auth/login');
    assert.deepEqual(JSON.parse(String(adminRequest?.data)), {
      username: 'operator',
      password: 'password',
    });
    console.log('auth api contract passed');
  } finally {
    userClient.defaults.adapter = originalUserAdapter;
    adminClient.defaults.adapter = originalAdminAdapter;
  }
})();
