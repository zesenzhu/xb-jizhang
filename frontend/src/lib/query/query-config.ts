import type { LedgerListQuery } from '@/lib/api/ledger-types';
import type { StatisticsOverviewQuery, TransactionListQuery } from '@/lib/api/transaction-types';

export const queryStaleTime = {
  currentUser: 5 * 60 * 1000,
  ledgers: 60 * 1000,
  accounts: 5 * 60 * 1000,
  categories: 5 * 60 * 1000,
  members: 5 * 60 * 1000,
  transactions: 30 * 1000,
} as const;

/**
 * 剔除空值并按固定键序输出，保证同一组筛选条件永远生成同一个缓存键。
 * 若不归一化，`{a:1}` 与 `{a:1,b:undefined}` 会产生两个键，缓存永不命中。
 */
function normalizeFilter<T extends object>(filter: T): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  for (const key of Object.keys(filter).sort()) {
    const value = (filter as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = value as string | number;
    }
  }
  return normalized;
}

export const queryKeys = {
  currentUser: ['user', 'me'] as const,
  ledgers: {
    all: ['ledgers'] as const,
    list: (query: LedgerListQuery = {}) => ['ledgers', 'list', query] as const,
    detail: (ledgerId: string) => ['ledgers', 'detail', ledgerId] as const,
  },
  accounts: (ledgerId: string) => ['ledger', ledgerId, 'accounts'] as const,
  categories: (ledgerId: string) => ['ledger', ledgerId, 'categories'] as const,
  members: (ledgerId: string) => ['ledger', ledgerId, 'members'] as const,
  transactions: {
    all: (ledgerId: string) => ['ledger', ledgerId, 'transactions'] as const,
    list: (ledgerId: string, filter: TransactionListQuery = {}) =>
      ['ledger', ledgerId, 'transactions', 'list', normalizeFilter(filter)] as const,
  },
  statistics: {
    overview: (ledgerId: string, filter: StatisticsOverviewQuery = {}) =>
      ['ledger', ledgerId, 'statistics', 'overview', normalizeFilter(filter)] as const,
  },
} as const;
