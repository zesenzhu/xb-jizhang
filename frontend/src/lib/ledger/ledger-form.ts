import type { LedgerSummary } from '@/lib/api/ledger-types';

export function validateLedgerName(name: string): string | null {
  return name.trim() ? null : '请输入账本名称';
}

/**
 * 决定进站后使用哪本账本。
 *
 * 优先级：本地已选（且仍在可访问列表里）→ 服务端标记的 `isCurrent` → 列表第一本。
 * 中间那层是二期新增的：换设备或清缓存后本地 store 是空的，
 * 此时应以服务端偏好为准，而不是随便取列表第一本。
 */
export function resolveInitialLedgerId(
  ledgers: readonly Pick<LedgerSummary, 'id' | 'isCurrent'>[],
  currentLedgerId: string | null,
): string | null {
  if (currentLedgerId && ledgers.some((ledger) => ledger.id === currentLedgerId)) {
    return currentLedgerId;
  }
  const preferred = ledgers.find((ledger) => ledger.isCurrent);
  return preferred?.id ?? ledgers[0]?.id ?? null;
}
