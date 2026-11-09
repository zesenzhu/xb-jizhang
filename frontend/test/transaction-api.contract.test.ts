import assert from 'node:assert/strict';
import type { AxiosAdapter } from 'axios';
import { getTransactions } from '../src/lib/api/transaction-api';
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
      if (config.url === '/ledgers/ledger-1/note-suggestions') {
        return okResponse(config, { items: [{ text: '午餐', lastUsedAt: '2026-11-08T08:00:00.000Z' }] });
      }
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

    // 一级分类下钻：categoryRootId 直接透传给列表接口。
    await getTransactions('ledger-1', { page: 1, categoryRootId: 'root-1' });
    assert.deepEqual(captured.at(-1)?.params, { page: 1, categoryRootId: 'root-1' });

    // 组合筛选：时间区间、类型、账户、付款人、关键词同时透传，键名与后端 DTO 一致。
    await getTransactions('ledger-1', {
      page: 1,
      pageSize: 30,
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-07T16:00:00.000Z',
      type: 'EXPENSE',
      accountId: 'account-1',
      payerId: 'user-2',
      createdById: 'user-3',
      keyword: '早餐',
    });
    assert.deepEqual(captured.at(-1)?.params, {
      page: 1,
      pageSize: 30,
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-07T16:00:00.000Z',
      type: 'EXPENSE',
      accountId: 'account-1',
      payerId: 'user-2',
      createdById: 'user-3',
      keyword: '早餐',
    });

    const { getNoteSuggestions } = await import('../src/lib/api/transaction-api');
    const noteResult = await getNoteSuggestions('ledger-1', 10);
    assert.equal(noteResult.items[0]?.text, '午餐');
    assert.equal(captured.at(-1)?.method, 'get');
    assert.equal(captured.at(-1)?.url, '/ledgers/ledger-1/note-suggestions');
    assert.deepEqual(captured.at(-1)?.params, { limit: 10 });

    console.log('transaction api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
