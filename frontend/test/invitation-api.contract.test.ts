import assert from 'node:assert/strict';
import {
  acceptInvitation,
  acceptInvitationById,
  createInvitation,
  declineInvitation,
  declineInvitationById,
  getInvitationByToken,
  getInvitationPreview,
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
      : config.url === '/invitations/preview'
        ? { ledgerName: '家庭账本', inviterName: '小宝', role: 'EDITOR' as const, status: 'PENDING' as const, expiresAt: '2026-11-08T08:00:00.000Z', canRespondAfterLogin: true }
        : config.url === '/invitations/token'
        ? { ...invitation, targetEmailMasked: 'm***@example.com', hasEmail: true, emailMatched: true, canAccept: true, canDecline: true, blockedReason: null }
        : config.url?.endsWith('/accept')
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
        : config.method === 'delete' || config.url?.endsWith('/decline')
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
    const acceptedById = await acceptInvitationById('invitation-1');
    const detail = await getInvitationByToken('one-time-token');
    const preview = await getInvitationPreview('one-time-token');
    const declined = await declineInvitation('one-time-token');
    const declinedById = await declineInvitationById('invitation-1');

    // Token 只在创建响应里出现；后续查询拿不到（这是「我的邀请」不能凭空给接受按钮的原因）。
    assert.equal(created.inviteToken, 'one-time-token');
    assert.equal(revoked, null);
    assert.equal(ledgerInvitations.length, 1);
    assert.equal(mine.length, 1);
    assert.equal(accepted.memberRole, 'EDITOR');
    assert.equal(acceptedById.memberRole, 'EDITOR');
    assert.equal(detail.emailMatched, true);
    assert.equal(preview.ledgerName, '家庭账本');
    assert.equal(declined, null);
    assert.equal(declinedById, null);

    const byMethodAndUrl = (method: string, url: string) =>
      requests.find((request) => request.method === method && request.url === url);

    assert.deepEqual(
      {
        method: byMethodAndUrl('post', '/ledgers/ledger-1/invitations')?.method,
        url: byMethodAndUrl('post', '/ledgers/ledger-1/invitations')?.url,
        data: JSON.parse(String(byMethodAndUrl('post', '/ledgers/ledger-1/invitations')?.data)),
      },
      {
        method: 'post',
        url: '/ledgers/ledger-1/invitations',
        data: { targetEmail: 'ming@example.com', role: 'EDITOR' },
      },
    );
    assert.ok(byMethodAndUrl('delete', '/ledgers/ledger-1/invitations/invitation-1'));
    assert.ok(byMethodAndUrl('get', '/ledgers/ledger-1/invitations'));
    assert.ok(byMethodAndUrl('get', '/invitations'));
    assert.ok(byMethodAndUrl('get', '/invitations/token'));
    assert.ok(byMethodAndUrl('post', '/invitations/accept'));
    assert.ok(byMethodAndUrl('post', '/invitations/decline'));
    assert.ok(byMethodAndUrl('post', '/invitations/invitation-1/accept'));
    assert.ok(byMethodAndUrl('post', '/invitations/invitation-1/decline'));

    const allowed = new Set([
      '/ledgers/ledger-1/invitations',
      '/ledgers/ledger-1/invitations/invitation-1',
      '/invitations',
      '/invitations/accept',
      '/invitations/decline',
      '/invitations/invitation-1/accept',
      '/invitations/invitation-1/decline',
      '/invitations/token',
      '/invitations/preview',
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
