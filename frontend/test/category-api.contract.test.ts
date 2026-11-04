import assert from 'node:assert/strict';
import type { AxiosAdapter } from 'axios';
import { getCategories } from '../src/lib/api/category-api';
import { userClient } from '../src/lib/api/user-client';

type AdapterConfig = Parameters<AxiosAdapter>[0];

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  try {
    let captured: { url?: string; params?: unknown } | undefined;
    userClient.defaults.adapter = async (config: AdapterConfig) => {
      captured = { url: config.url, params: config.params };
      return Promise.resolve({
        data: {
          success: true,
          code: 0,
          message: '操作成功',
          data: { items: [], total: 0, page: 1, pageSize: 100, hasNextPage: false },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };

    const result = await getCategories('ledger/with slash', {
      page: 1,
      pageSize: 100,
      type: 'EXPENSE',
      includeInactive: false,
    });

    assert.deepEqual(result.items, []);
    assert.equal(captured?.url, '/ledgers/ledger%2Fwith%20slash/categories');
    assert.deepEqual(captured?.params, {
      page: 1,
      pageSize: 100,
      type: 'EXPENSE',
      includeInactive: false,
    });
    console.log('category api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
