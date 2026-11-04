import assert from 'node:assert/strict';
import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { createApiClient, shouldSkipAuthRefresh } from '../src/lib/api/client';
import { createRefreshQueue } from '../src/lib/api/refresh-queue';
import { adminClient, ADMIN_REFRESH_PATH } from '../src/lib/api/admin-client';
import { userClient, USER_REFRESH_PATH } from '../src/lib/api/user-client';

assert.equal(userClient.defaults.withCredentials, true);
assert.equal(adminClient.defaults.withCredentials, true);
assert.equal(USER_REFRESH_PATH, '/auth/refresh');
assert.equal(ADMIN_REFRESH_PATH, '/admin/auth/refresh');
assert.equal(shouldSkipAuthRefresh('/auth/login', ['/auth/login']), true);
assert.equal(shouldSkipAuthRefresh('/auth/login?from=expired', ['/auth/login']), true);
assert.equal(shouldSkipAuthRefresh('/users/me', ['/auth/login']), false);

void (async () => {
  const queue = createRefreshQueue();
  let refreshCount = 0;
  const refresh = (): Promise<void> => {
    refreshCount += 1;
    return new Promise((resolve) => setTimeout(resolve, 5));
  };

  await Promise.all([queue.run(refresh), queue.run(refresh), queue.run(refresh)]);
  assert.equal(refreshCount, 1);

  console.log('api client contract passed');
})();

void (async () => {
  const originalAdapter = axios.defaults.adapter;
  try {
    axios.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        return {
          data: { success: true, code: 0, message: '刷新成功', data: null },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      }

      const response = {
        data: { success: false, code: 40101, message: '登录状态已失效', data: null },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      };
      throw new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, response);
    };

    let authFailureCount = 0;
    const client = createApiClient({
      refreshPath: '/auth/refresh',
      onRefreshFailure: () => {
        authFailureCount += 1;
      },
    });
    await assert.rejects(client.get('/protected-resource'));
    assert.equal(authFailureCount, 1);
    console.log('api client final 401 contract passed');

    axios.defaults.adapter = async (config) => {
      const response = {
        data: { success: false, code: 40101, message: '登录状态已失效', data: null },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      };
      throw new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, response);
    };

    authFailureCount = 0;
    const concurrentClient = createApiClient({
      refreshPath: '/auth/refresh',
      onRefreshFailure: () => {
        authFailureCount += 1;
      },
    });
    await Promise.allSettled([concurrentClient.get('/accounts'), concurrentClient.get('/categories')]);
    assert.equal(authFailureCount, 1);
    console.log('api client concurrent 401 contract passed');
  } finally {
    axios.defaults.adapter = originalAdapter;
  }
})();
