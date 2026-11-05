import type { QueryClient } from '@tanstack/react-query';
import { updateLedgerPreferences } from '@/lib/api/ledger-api';
import { queryKeys } from '@/lib/query/query-config';

/**
 * 移除某个账本名下的账单/统计/成员缓存。
 *
 * 需求 5.2：切换账本后旧账本的统计、流水与成员信息不得残留。
 * 只改 `currentLedgerId` 不够——旧账本的 query 仍在缓存里，
 * 一旦用户切回去或某个组件重挂载就会先渲染旧数据。
 */
export function removeLedgerScopedQueries(queryClient: QueryClient, ledgerId: string): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] === 'ledger' && query.queryKey[1] === ledgerId,
  });
}

export interface SwitchLedgerArgs {
  queryClient: QueryClient;
  ledgerId: string;
  /** 切换前的当前账本；用于清理它的缓存 */
  currentLedgerId: string | null;
  setCurrentLedgerId: (ledgerId: string) => void;
}

/**
 * 切换当前账本。
 *
 * 顺序刻意固定：先写服务端偏好，成功后再失效账本缓存、清理旧账本缓存、更新本地 store。
 * 任何一步失败都不能提前改 store，否则界面会显示「已切换」但服务端仍是旧账本。
 */
export async function switchLedger({
  queryClient,
  ledgerId,
  currentLedgerId,
  setCurrentLedgerId,
}: SwitchLedgerArgs): Promise<void> {
  if (currentLedgerId === ledgerId) {
    setCurrentLedgerId(ledgerId);
    return;
  }

  const preferences = await updateLedgerPreferences({ currentLedgerId: ledgerId });
  queryClient.setQueryData(queryKeys.ledgerPreferences, preferences);
  await queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all });

  if (currentLedgerId) removeLedgerScopedQueries(queryClient, currentLedgerId);
  setCurrentLedgerId(ledgerId);
}
