import type { LedgerSummary, LedgerType } from '@/lib/api/ledger-types';
import type { LedgerMemberRole } from '@/lib/api/ledger-types';

/** 「我的账本」的一个分组；空组不返回，页面据此决定是否渲染小标题。 */
export interface LedgerGroup {
  type: LedgerType;
  title: string;
  items: LedgerSummary[];
}

/** 账本操作菜单项。`key` 与交互层的路由/面板一一对应。 */
export interface LedgerAction {
  key: 'settings' | 'copy' | 'delete';
  label: string;
  description?: string;
  danger?: boolean;
}

export const LEDGER_TYPE_TITLES: Record<LedgerType, string> = {
  PERSONAL: '个人账本',
  SHARED: '共享账本',
};

const CURRENCY_LABELS: Record<string, string> = {
  CNY: '人民币 CNY',
  USD: '美元 USD',
  EUR: '欧元 EUR',
  JPY: '日元 JPY',
  HKD: '港币 HKD',
};

/** 币种展示名；未知代码原样返回，不猜语言。 */
export function currencyLabel(code: string): string {
  return CURRENCY_LABELS[code] ?? code;
}

/** 角色展示名；与 `LedgerBadge` 的措辞保持一致。 */
export function roleLabel(role: LedgerMemberRole): string {
  if (role === 'OWNER') return '所有者';
  if (role === 'EDITOR') return '记账协作';
  return '只读观察';
}

/**
 * 按类型分组，组内 `createdAt` 升序。
 *
 * 用创建时间而不是名称排序：账本可改名，改名后卡片乱跳会让用户找不到刚切换的那本。
 * 时间相同时用 id 兜底，保证同一份数据每次渲染顺序一致。
 */
export function groupLedgers(
  ledgers: readonly LedgerSummary[],
): { personal: LedgerSummary[]; shared: LedgerSummary[] } {
  const sortByCreated = (left: LedgerSummary, right: LedgerSummary): number => {
    const diff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return diff !== 0 ? diff : left.id.localeCompare(right.id);
  };

  return {
    personal: ledgers.filter((ledger) => ledger.type === 'PERSONAL').sort(sortByCreated),
    shared: ledgers.filter((ledger) => ledger.type === 'SHARED').sort(sortByCreated),
  };
}

/** 个人在前、共享在后；只返回非空分组。 */
export function buildLedgerGroups(ledgers: readonly LedgerSummary[]): LedgerGroup[] {
  const { personal, shared } = groupLedgers(ledgers);
  const groups: LedgerGroup[] = [];
  if (personal.length > 0) {
    groups.push({ type: 'PERSONAL', title: LEDGER_TYPE_TITLES.PERSONAL, items: personal });
  }
  if (shared.length > 0) {
    groups.push({ type: 'SHARED', title: LEDGER_TYPE_TITLES.SHARED, items: shared });
  }
  return groups;
}

/** 只有 Owner 能管理账本；Editor/Viewer 仍可切换与查看。 */
export function canManageLedger(ledger: Pick<LedgerSummary, 'memberRole'>): boolean {
  return ledger.memberRole === 'OWNER';
}

/**
 * 删除条件里前端**能**判断的部分。
 *
 * 是否含账单、是否有待处理邀请只有服务端知道（账单计数不在摘要里，
 * 且账本邀请列表接口缺失 P5），所以这两项不放进来，交给 40911/40913 的错误文案兜底。
 */
export function deleteBlockers(
  ledger: Pick<LedgerSummary, 'memberCount'>,
  context: { ledgerCount: number },
): string[] {
  const blockers: string[] = [];
  if (context.ledgerCount <= 1) {
    blockers.push('这是你的最后一本账本，请先新建或加入其他账本');
  }
  if (ledger.memberCount > 1) {
    blockers.push('账本还有其他成员，请先移除');
  }
  return blockers;
}

/**
 * 操作菜单项。
 *
 * 只有 Owner 有管理项（需求 7.1）：Editor/Viewer 连 `⋯` 都不渲染，
 * 所以这里对非 Owner 返回空数组，而不是给出一个点了没反应的占位项。
 */
export function ledgerActions(
  ledger: Pick<LedgerSummary, 'memberRole'>,
  options: { canDelete: boolean; deleteDisabledReason?: string | null },
): LedgerAction[] {
  if (!canManageLedger(ledger)) return [];

  return [
    { key: 'settings', label: '账本设置', description: '名称、时区、成员与分类' },
    { key: 'copy', label: '复制账本', description: '复制账本设置与分类，不含账单' },
    {
      key: 'delete',
      label: '删除账本',
      ...(options.canDelete
        ? { danger: true, description: '仅空账本可删除，且无法恢复' }
        : { description: options.deleteDisabledReason ?? '当前不满足删除条件' }),
    },
  ];
}

/**
 * 币种是否可改。
 *
 * 一旦有账单（含软删除）就不能改：历史金额的解释单位会变，
 * 服务端也会拒绝（40902），前端只是提前把入口关掉。
 */
export function currencyEditable(ledger: Pick<LedgerSummary, 'memberRole'>, hasTransactions: boolean): boolean {
  return canManageLedger(ledger) && !hasTransactions;
}

/** 一次性邀请链接；Token 只在创建响应里出现一次，必须当场展示并允许复制。 */
export function buildInviteLink(token: string, origin?: string): string {
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  return `${base}/user/invitations?token=${encodeURIComponent(token)}`;
}
