import type { LedgerListQuery } from '@/lib/api/ledger-types';
import type { StatisticsOverviewQuery, TransactionListQuery } from '@/lib/api/transaction-types';
import type {
  CategoryQuery,
  StatisticsQuery,
  TrendQuery,
} from '@/lib/api/statistics-types';

/** 公共时间范围 + 公共筛选，四个统计模块共享。 */
export type StatisticsScope = StatisticsQuery;
export type StatisticsScopeTrend = TrendQuery;
export type StatisticsScopeCategories = CategoryQuery;

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
    /** 二期统计页的公共时间范围与筛选上下文；四个模块共用同一份，保证口径一致。 */
    scope: (ledgerId: string, scope: StatisticsScope) =>
      ['ledger', ledgerId, 'statistics', 'scope', normalizeFilter(scope)] as const,
    overview: (ledgerId: string, filter: StatisticsOverviewQuery = {}) =>
      ['ledger', ledgerId, 'statistics', 'overview', normalizeFilter(filter)] as const,
    /**
     * 趋势/分类/汇总各自的键必须独立：
     * 趋势切 metric、分类切 type/level 都只影响自己那一块，
     * 混用同一个键会让另外两块跟着重新请求。
     */
    trend: (ledgerId: string, query: StatisticsScopeTrend) =>
      ['ledger', ledgerId, 'statistics', 'trend', normalizeFilter(query)] as const,
    categories: (ledgerId: string, query: StatisticsScopeCategories) =>
      ['ledger', ledgerId, 'statistics', 'categories', normalizeFilter(query)] as const,
    periods: (ledgerId: string, query: StatisticsScope) =>
      ['ledger', ledgerId, 'statistics', 'periods', normalizeFilter(query)] as const,
  },
} as const;
