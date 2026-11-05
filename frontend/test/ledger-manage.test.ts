import assert from 'node:assert/strict';
import {
  buildInviteLink,
  buildLedgerGroups,
  canManageLedger,
  currencyEditable,
  currencyLabel,
  deleteBlockers,
  groupLedgers,
  ledgerActions,
  roleLabel,
} from '../src/lib/ledger/ledger-manage';
import type { LedgerSummary } from '../src/lib/api/ledger-types';

function ledger(overrides: Partial<LedgerSummary> & Pick<LedgerSummary, 'id'>): LedgerSummary {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    type: overrides.type ?? 'PERSONAL',
    defaultCurrency: overrides.defaultCurrency ?? 'CNY',
    timezone: overrides.timezone ?? 'Asia/Shanghai',
    icon: overrides.icon ?? null,
    color: overrides.color ?? null,
    isArchived: overrides.isArchived ?? false,
    memberRole: overrides.memberRole ?? 'OWNER',
    memberCount: overrides.memberCount ?? 1,
    isCurrent: overrides.isCurrent ?? false,
    isDefault: overrides.isDefault ?? false,
    joinedAt: overrides.joinedAt ?? '2026-01-01T00:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

const older = ledger({ id: 'a-older', createdAt: '2026-01-01T00:00:00.000Z' });
const newer = ledger({ id: 'b-newer', createdAt: '2026-02-01T00:00:00.000Z' });
const shared = ledger({
  id: 'c-shared',
  type: 'SHARED',
  createdAt: '2026-01-15T00:00:00.000Z',
  memberRole: 'EDITOR',
  memberCount: 4,
});

// 个人在前、共享在后；组内按 createdAt 升序而不是名称或列表顺序。
const grouped = groupLedgers([shared, newer, older]);
assert.deepEqual(grouped.personal.map((item) => item.id), ['a-older', 'b-newer']);
assert.deepEqual(grouped.shared.map((item) => item.id), ['c-shared']);

// 同一创建时间时用 id 兜底，保证渲染顺序稳定（否则改名/刷新会让卡片乱跳）。
const tieA = ledger({ id: 'z-tie' });
const tieB = ledger({ id: 'a-tie' });
assert.deepEqual(
  groupLedgers([tieA, tieB]).personal.map((item) => item.id),
  ['a-tie', 'z-tie'],
);

// 分组只返回非空组：没有共享账本时不渲染「共享账本」小标题。
assert.deepEqual(
  buildLedgerGroups([older]).map((group) => ({ type: group.type, title: group.title })),
  [{ type: 'PERSONAL', title: '个人账本' }],
);
assert.deepEqual(
  buildLedgerGroups([shared, older]).map((group) => group.title),
  ['个人账本', '共享账本'],
);
assert.deepEqual(buildLedgerGroups([]), []);

// 权限：只有 Owner 能管理；Editor/Viewer 仍可切换与查看。
assert.equal(canManageLedger(ledger({ id: 'x', memberRole: 'OWNER' })), true);
assert.equal(canManageLedger(ledger({ id: 'x', memberRole: 'EDITOR' })), false);
assert.equal(canManageLedger(ledger({ id: 'x', memberRole: 'VIEWER' })), false);

// 删除条件里前端能判断的部分。账单与待处理邀请只有服务端知道，不放进来。
assert.deepEqual(deleteBlockers({ memberCount: 1 }, { ledgerCount: 2 }), []);
assert.deepEqual(deleteBlockers({ memberCount: 3 }, { ledgerCount: 2 }), [
  '账本还有其他成员，请先移除',
]);
assert.deepEqual(deleteBlockers({ memberCount: 1 }, { ledgerCount: 1 }), [
  '这是你的最后一本账本，请先新建或加入其他账本',
]);
assert.deepEqual(deleteBlockers({ memberCount: 2 }, { ledgerCount: 1 }), [
  '这是你的最后一本账本，请先新建或加入其他账本',
  '账本还有其他成员，请先移除',
]);

// 操作菜单：Owner 三项；非 Owner 只有「查看账本信息」，不出现点不动的管理项。
const ownerActions = ledgerActions(ledger({ id: 'x' }), { canDelete: true });
assert.deepEqual(ownerActions.map((action) => action.key), ['settings', 'copy', 'delete']);
assert.equal(ownerActions.at(-1)?.danger, true);

const blockedActions = ledgerActions(ledger({ id: 'x' }), {
  canDelete: false,
  deleteDisabledReason: '账本还有其他成员，请先移除',
});
assert.equal(blockedActions.at(-1)?.danger, undefined);
assert.equal(blockedActions.at(-1)?.description, '账本还有其他成员，请先移除');

// Editor/Viewer 连 `⋯` 都不渲染，所以菜单项必须为空（不是「点了没反应」的占位项）。
assert.deepEqual(ledgerActions(ledger({ id: 'x', memberRole: 'VIEWER' }), { canDelete: true }), []);
assert.deepEqual(ledgerActions(ledger({ id: 'x', memberRole: 'EDITOR' }), { canDelete: true }), []);

// 币种展示名：已知代码翻译，未知代码原样返回。
assert.equal(currencyLabel('CNY'), '人民币 CNY');
assert.equal(currencyLabel('JPY'), '日元 JPY');
assert.equal(currencyLabel('XYZ'), 'XYZ');

// 有账单即锁定币种；非 Owner 也不能改。
assert.equal(currencyEditable(ledger({ id: 'x' }), false), true);
assert.equal(currencyEditable(ledger({ id: 'x' }), true), false);
assert.equal(currencyEditable(ledger({ id: 'x', memberRole: 'EDITOR' }), false), false);

// 角色文案与 LedgerBadge 一致。
assert.equal(roleLabel('OWNER'), '所有者');
assert.equal(roleLabel('EDITOR'), '记账协作');
assert.equal(roleLabel('VIEWER'), '只读观察');

// 邀请链接：Token 做 URL 编码，落在「我的邀请」页。
assert.equal(
  buildInviteLink('abc+/=', 'https://jizhang.example.com'),
  'https://jizhang.example.com/user/invitations?token=abc%2B%2F%3D',
);

console.log('ledger manage contract passed');
