import assert from 'node:assert/strict';
import {
  getLedgerMembers,
  leaveLedger,
  removeMember,
  transferOwnership,
  updateMemberRole,
} from '../src/lib/api/member-api';
import { userClient } from '../src/lib/api/user-client';

const member = {
  id: 'member-1',
  ledgerId: 'ledger-1',
  userId: 'user-2',
  role: 'EDITOR' as const,
  status: 'ACTIVE' as const,
  joinedAt: '2026-10-30T08:00:00.000Z',
  user: { id: 'user-2', username: 'zhou', nickname: '周宁', avatar: null },
};

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const requests: Array<{ method?: string; url?: string; params?: unknown; data?: unknown }> = [];

  userClient.defaults.adapter = async (config) => {
    requests.push(config);
    const data = config.method === 'get'
      ? { items: [member], total: 1, page: 1, pageSize: 100, hasNextPage: false }
      : config.url === '/ledgers/ledger-1/ownership-transfer'
        ? { previousOwner: member, newOwner: member }
        : config.method === 'patch'
          ? member
          : null;

    return {
      data: { success: true, code: 0, message: '操作成功', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  try {
    const list = await getLedgerMembers('ledger-1');
    const updated = await updateMemberRole('ledger-1', 'member-1', 'VIEWER');
    const removed = await removeMember('ledger-1', 'member-1');
    const left = await leaveLedger('ledger-1');
    const transferred = await transferOwnership('ledger-1', 'member-1');

    assert.equal(list.items[0]?.role, 'EDITOR');
    assert.equal(updated.role, 'EDITOR');
    assert.equal(removed, null);
    assert.equal(left, null);
    assert.equal(transferred.newOwner.id, 'member-1');

    assert.deepEqual(
      { method: requests[0]?.method, url: requests[0]?.url, params: requests[0]?.params },
      { method: 'get', url: '/ledgers/ledger-1/members', params: { page: 1, pageSize: 100 } },
    );
    // 改角色只提交 role，不夹带 userId 等可由服务端从认证上下文取得的字段。
    assert.deepEqual(
      { method: requests[1]?.method, url: requests[1]?.url, data: JSON.parse(String(requests[1]?.data)) },
      { method: 'patch', url: '/ledgers/ledger-1/members/member-1/role', data: { role: 'VIEWER' } },
    );
    assert.deepEqual(
      { method: requests[2]?.method, url: requests[2]?.url },
      { method: 'delete', url: '/ledgers/ledger-1/members/member-1' },
    );
    assert.deepEqual(
      { method: requests[3]?.method, url: requests[3]?.url },
      { method: 'post', url: '/ledgers/ledger-1/members/leave' },
    );
    assert.deepEqual(
      { method: requests[4]?.method, url: requests[4]?.url, data: JSON.parse(String(requests[4]?.data)) },
      {
        method: 'post',
        url: '/ledgers/ledger-1/ownership-transfer',
        data: { targetMemberId: 'member-1' },
      },
    );

    console.log('member api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
