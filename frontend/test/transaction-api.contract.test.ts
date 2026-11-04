import assert from 'node:assert/strict';
import type { AxiosAdapter } from 'axios';
import { getStatisticsOverview, getTransactions } from '../src/lib/api/transaction-api';
import { userClient } from '../src/lib/api/user-client';

interface CapturedRequest {
  method?: string;
  url?: string;
  params?: unknown;
}

type AdapterConfig = Parameters<AxiosAdapter>[0];

function okResponse(config: AdapterConfig, data: unknown) {
  return Promise.resolve({
    data: { success: true, code: 0, message: '操作成功', data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const captured: CapturedRequest[] = [];

  try {
    userClient.defaults.adapter = async (config) => {
      captured.push({ method: config.method, url: config.url, params: config.params });
      return okResponse(config, { items: [], total: 0, page: 1, pageSize: 30, hasNextPage: false });
    };

    await getTransactions('ledger-1', {
      page: 2,
      pageSize: 30,
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    });
    assert.equal(captured.at(-1)?.method, 'get');
    assert.equal(captured.at(-1)?.url, '/ledgers/ledger-1/transactions');
    assert.deepEqual(captured.at(-1)?.params, {
      page: 2,
      pageSize: 30,
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    });

    // 值为 undefined 或空串的筛选项不进入查询串，避免服务端把它当成有效条件。
    await getTransactions('ledger-1', { page: 1, type: undefined, keyword: '' });
    assert.deepEqual(captured.at(-1)?.params, { page: 1 });

    // 账本 ID 做 URL 编码，防止拼接特殊字符。
    await getTransactions('ledger/with slash', {});
    assert.equal(captured.at(-1)?.url, '/ledgers/ledger%2Fwith%20slash/transactions');

    userClient.defaults.adapter = async (config) => {
      captured.push({ method: config.method, url: config.url, params: config.params });
      return okResponse(config, {
        from: null,
        to: null,
        totalIncomeCents: 0,
        totalExpenseCents: 0,
        netCents: 0,
        transactionCount: 0,
      });
    };

    await getStatisticsOverview('ledger-1', {
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    });
    assert.equal(captured.at(-1)?.url, '/ledgers/ledger-1/statistics/overview');
    assert.deepEqual(captured.at(-1)?.params, {
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-30T16:00:00.000Z',
    });

    console.log('transaction api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
