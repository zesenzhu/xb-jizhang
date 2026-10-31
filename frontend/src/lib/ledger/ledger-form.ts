import type { LedgerSummary } from '@/lib/api/ledger-types';

export function validateLedgerName(name: string): string | null {
  return name.trim() ? null : '请输入账本名称';
}

export function resolveInitialLedgerId(
  ledgers: readonly Pick<LedgerSummary, 'id'>[],
  currentLedgerId: string | null,
): string | null {
  if (currentLedgerId && ledgers.some((ledger) => ledger.id === currentLedgerId)) {
    return currentLedgerId;
  }
  return ledgers[0]?.id ?? null;
}
