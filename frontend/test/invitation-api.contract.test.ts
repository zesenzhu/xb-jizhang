import assert from 'node:assert/strict';
import {
  acceptInvitation,
  createInvitation,
  declineInvitation,
  getLedgerInvitations,
  getMyInvitations,
  revokeInvitation,
} from '../src/lib/api/invitation-api';
import { userClient } from '../src/lib/api/user-client';

const invitation = {
  id: 'invitation-1',
  ledgerId: 'ledger-1',
  targetEmail: 'ming@example.com',
  role: 'EDITOR' as const,
  status: 'PENDING' as const,
  expiresAt: '2026-11-08T08:00:00.000Z',
  inviteToken: 'one-time-token',
};

void (async () => {
  const originalAdapter = userClient.defaults.adapter;
  const requests: Array<{ method?: string; url?: string; data?: unknown }> = [];

  userClient.defaults.adapter = async (config) => {
    requests.push(config);
    const data = config.url === '/invitations' ||
      (config.method === 'get' && config.url === '/ledgers/ledger-1/invitations')
      ? [invitation]
      : config.url === '/invitations/accept'
        ? {
            id: 'invitation-1',
            ledgerId: 'ledger-1',
            memberRole: 'EDITOR' as const,
            joinedAt: '2026-11-05T08:00:00.000Z',
            ledger: {
              id: 'ledger-1',
              name: '家庭账本',
              type: 'SHARED' as const,
              defaultCurrency: 'CNY',
              icon: null,
              color: null,
              isArchived: false,
            },
          }
        : config.method === 'delete' || config.url === '/invitations/decline'
          ? null
          : invitation;

    return {
      data: { success: true, code: 0, message: '操作成功', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  try {
    const created = await createInvitation('ledger-1', {
      targetEmail: 'ming@example.com',
      role: 'EDITOR',
    });
    const revoked = await revokeInvitation('ledger-1', 'invitation-1');
    const ledgerInvitations = await getLedgerInvitations('ledger-1');
    const mine = await getMyInvitations();
    const accepted = await acceptInvitation('one-time-token');
    const declined = await declineInvitation('one-time-token');

    // Token 只在创建响应里出现；后续查询拿不到（这是「我的邀请」不能凭空给接受按钮的原因）。
    assert.equal(created.inviteToken, 'one-time-token');
    assert.equal(revoked, null);
    assert.equal(ledgerInvitations.length, 1);
    assert.equal(mine.length, 1);
    assert.equal(accepted.memberRole, 'EDITOR');
    assert.equal(declined, null);

    assert.deepEqual(
      { method: requests[0]?.method, url: requests[0]?.url, data: JSON.parse(String(requests[0]?.data)) },
      {
        method: 'post',
        url: '/ledgers/ledger-1/invitations',
        data: { targetEmail: 'ming@example.com', role: 'EDITOR' },
      },
    );
    assert.deepEqual(
      { method: requests[1]?.method, url: requests[1]?.url },
      { method: 'delete', url: '/ledgers/ledger-1/invitations/invitation-1' },
    );
    assert.deepEqual(
      { method: requests[2]?.method, url: requests[2]?.url },
      { method: 'get', url: '/ledgers/ledger-1/invitations' },
    );
    assert.deepEqual(
      { method: requests[3]?.method, url: requests[3]?.url },
      { method: 'get', url: '/invitations' },
    );
    assert.deepEqual(
      { method: requests[4]?.method, url: requests[4]?.url, data: JSON.parse(String(requests[4]?.data)) },
      { method: 'post', url: '/invitations/accept', data: { token: 'one-time-token' } },
    );
    assert.deepEqual(
      { method: requests[5]?.method, url: requests[5]?.url, data: JSON.parse(String(requests[5]?.data)) },
      { method: 'post', url: '/invitations/decline', data: { token: 'one-time-token' } },
    );

    const allowed = new Set([
      '/ledgers/ledger-1/invitations',
      '/ledgers/ledger-1/invitations/invitation-1',
      '/invitations',
      '/invitations/accept',
      '/invitations/decline',
    ]);
    for (const request of requests) {
      assert.ok(
        allowed.has(String(request.url)),
        `invitation-api 调用了未登记的路径：${String(request.url)}`,
      );
    }
    assert.ok(requests.some((request) => request.method === 'get' && String(request.url) === '/ledgers/ledger-1/invitations'));

    console.log('invitation api contract passed');
  } finally {
    userClient.defaults.adapter = originalAdapter;
  }
})();
