import type { LedgerListQuery } from '@/lib/api/ledger-types';

export const queryStaleTime = {
  currentUser: 5 * 60 * 1000,
  ledgers: 60 * 1000,
  accounts: 5 * 60 * 1000,
  categories: 5 * 60 * 1000,
  transactions: 30 * 1000,
} as const;

export const queryKeys = {
  currentUser: ['user', 'me'] as const,
  ledgers: {
    all: ['ledgers'] as const,
    list: (query: LedgerListQuery = {}) => ['ledgers', 'list', query] as const,
    detail: (ledgerId: string) => ['ledgers', 'detail', ledgerId] as const,
  },
  accounts: (ledgerId: string) => ['ledger', ledgerId, 'accounts'] as const,
  categories: (ledgerId: string) => ['ledger', ledgerId, 'categories'] as const,
  transactions: (ledgerId: string) => ['ledger', ledgerId, 'transactions'] as const,
} as const;
