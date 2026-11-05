import assert from 'node:assert/strict';
import {
  copyLedger,
  createLedger,
  deleteLedger,
  getLedger,
  getLedgerPreferences,
  getLedgers,
  updateLedger,
  updateLedgerPreferences,
} from '../src/lib/api/ledger-api';
import type { CreateLedgerInput } from '../src/lib/api/ledger-types';
import { userClient } from '../src/lib/api/user-client';

const ledger = {
  id: 'ledger-1',
  name: '家庭账本',
  type: 'SHARED' as const,
  defaultCurrency: 'CNY',
  timezone: 'Asia/Shanghai',
  icon: null,
  color: null,
  isArchived: false,
  memberRole: 'OWNER' as const,
  memberCount: 4,
  isCurrent: true,
  isDefault: true,
  joinedAt: '2026-10-30T08:00:00.000Z',
  createdAt: '2026-10-30T08:00:00.000Z',
  updatedAt: '2026-10-30T08:00:00.000Z',
};

const preferences = {
  currentLedgerId: 'ledger-1',
  defaultLedgerId: 'ledger-1',
  currentLedger: {
    id: 'ledger-1',
    name: '家庭账本',
    type: 'SHARED' as const,
    defaultCurrency: 'CNY',
    timezone: 'Asia/Shanghai',
    memberRole: 'OWNER' as const,
  },
  defaultLedger: null,
  updatedAt: '2026-11-04T08:00:00.000Z',
};

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const requests: Array<{ method?: string; url?: string; params?: unknown; data?: unknown }> = [];

  userClient.defaults.adapter = async (config) => {
    requests.push(config);
    const isPreferences = config.url === '/me/ledger-preferences';
    const data = isPreferences
      ? preferences
      : config.method === 'delete'
        ? null
        : config.method === 'post' || config.method === 'patch'
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
    const list = await getLedgers({ page: 2, pageSize: 10 });
    const input: CreateLedgerInput = {
      name: '家庭账本',
      type: 'SHARED',
      defaultCurrency: 'CNY',
      timezone: 'Asia/Shanghai',
    };
    const created = await createLedger(input);
    const detail = await getLedger('ledger-1');
    const updated = await updateLedger('ledger-1', {
      name: '新家庭账本',
      timezone: 'Asia/Tokyo',
      updatedAt: ledger.updatedAt,
    });
    const prefs = await getLedgerPreferences();
    const patched = await updateLedgerPreferences({ currentLedgerId: 'ledger-2' });
    const copied = await copyLedger('ledger-1', {
      name: '家庭账本（副本）',
      type: 'SHARED',
      clientRequestId: 'request-1',
    });
    const removed = await deleteLedger('ledger-1');

    // 摘要字段必须能读到二期新增的服务端计算字段。
    assert.equal(list.items[0]?.memberCount, 4);
    assert.equal(list.items[0]?.isCurrent, true);
    assert.equal(list.items[0]?.timezone, 'Asia/Shanghai');
    assert.equal(created.id, 'ledger-1');
    assert.equal(detail.id, 'ledger-1');
    assert.equal(updated.id, 'ledger-1');
    assert.equal(prefs.currentLedgerId, 'ledger-1');
    assert.equal(patched.defaultLedger, null);
    assert.equal(copied.id, 'ledger-1');
    assert.equal(removed, null);

    assert.deepEqual(
      { method: requests[0]?.method, url: requests[0]?.url, params: requests[0]?.params },
      { method: 'get', url: '/ledgers', params: { page: 2, pageSize: 10 } },
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
      {
        method: 'patch',
        url: '/ledgers/ledger-1',
        data: { name: '新家庭账本', timezone: 'Asia/Tokyo', updatedAt: ledger.updatedAt },
      },
    );

    // 偏好接口：切换当前账本必须走服务端，不能只改本地 store。
    assert.deepEqual(
      { method: requests[4]?.method, url: requests[4]?.url },
      { method: 'get', url: '/me/ledger-preferences' },
    );
    assert.deepEqual(
      { method: requests[5]?.method, url: requests[5]?.url, data: JSON.parse(String(requests[5]?.data)) },
      {
        method: 'patch',
        url: '/me/ledger-preferences',
        data: { currentLedgerId: 'ledger-2' },
      },
    );

    // 复制：幂等键必须在请求体里，否则重试会建出第二个副本。
    assert.deepEqual(
      { method: requests[6]?.method, url: requests[6]?.url, data: JSON.parse(String(requests[6]?.data)) },
      {
        method: 'post',
        url: '/ledgers/ledger-1/copy',
        data: { name: '家庭账本（副本）', type: 'SHARED', clientRequestId: 'request-1' },
      },
    );

    // 删除：不带 force 等任何绕过参数，全部拦截条件由服务端判定。
    assert.deepEqual(
      { method: requests[7]?.method, url: requests[7]?.url, data: requests[7]?.data },
      { method: 'delete', url: '/ledgers/ledger-1', data: undefined },
    );

    // 账本 ID 做 URL 编码，防止拼接特殊字符。
    await getLedger('ledger/with slash');
    assert.equal(requests.at(-1)?.url, '/ledgers/ledger%2Fwith%20slash');

    console.log('ledger api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
