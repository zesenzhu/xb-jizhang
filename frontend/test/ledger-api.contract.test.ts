import assert from 'node:assert/strict';
import {
  createLedger,
  getLedger,
  getLedgers,
  updateLedger,
} from '../src/lib/api/ledger-api';
import type { CreateLedgerInput } from '../src/lib/api/ledger-types';
import { userClient } from '../src/lib/api/user-client';

const ledger = {
  id: 'ledger-1',
  name: '家庭账本',
  type: 'SHARED' as const,
  defaultCurrency: 'CNY',
  icon: null,
  color: null,
  isArchived: false,
  memberRole: 'OWNER' as const,
  joinedAt: '2026-10-30T08:00:00.000Z',
  createdAt: '2026-10-30T08:00:00.000Z',
  updatedAt: '2026-10-30T08:00:00.000Z',
};

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const requests: Array<{ method?: string; url?: string; params?: unknown; data?: unknown }> = [];

  userClient.defaults.adapter = async (config) => {
    requests.push(config);
    const data = config.method === 'post'
      ? ledger
      : config.url === '/ledgers/ledger-1'
        ? ledger
        : { items: [ledger], total: 1, page: 1, pageSize: 20, hasNextPage: false };

    return {
      data: { success: true, code: 0, message: '操作成功', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  try {
    const list = await getLedgers({ page: 2, pageSize: 10, includeArchived: true });
    const input: CreateLedgerInput = { name: '家庭账本', type: 'SHARED', defaultCurrency: 'CNY' };
    const created = await createLedger(input);
    const detail = await getLedger('ledger-1');
    const updated = await updateLedger('ledger-1', {
      name: '新家庭账本',
      updatedAt: ledger.updatedAt,
    });

    assert.equal(list.items[0]?.id, 'ledger-1');
    assert.equal(created.id, 'ledger-1');
    assert.equal(detail.id, 'ledger-1');
    assert.equal(updated.id, 'ledger-1');
    assert.deepEqual(
      { method: requests[0]?.method, url: requests[0]?.url, params: requests[0]?.params },
      { method: 'get', url: '/ledgers', params: { page: 2, pageSize: 10, includeArchived: true } },
    );
    assert.deepEqual(
      { method: requests[1]?.method, url: requests[1]?.url, data: JSON.parse(String(requests[1]?.data)) },
      { method: 'post', url: '/ledgers', data: input },
    );
    assert.deepEqual(
      { method: requests[2]?.method, url: requests[2]?.url },
      { method: 'get', url: '/ledgers/ledger-1' },
    );
    assert.deepEqual(
      { method: requests[3]?.method, url: requests[3]?.url, data: JSON.parse(String(requests[3]?.data)) },
      { method: 'patch', url: '/ledgers/ledger-1', data: { name: '新家庭账本', updatedAt: ledger.updatedAt } },
    );
    console.log('ledger api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
