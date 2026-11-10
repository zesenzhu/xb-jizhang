'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, ReceiptText, X } from 'lucide-react';
import { getTransactions } from '@/lib/api/transaction-api';
import { getStatisticsOverview } from '@/lib/api/statistics-api';
import { getAccounts } from '@/lib/api/account-api';
import { getCategories } from '@/lib/api/category-api';
import type { CategorySummary } from '@/lib/api/category-types';
import { ApiRequestError } from '@/lib/api/errors';
import { getLedger } from '@/lib/api/ledger-api';
import { getLedgerMembers } from '@/lib/api/member-api';
import { LEDGER_TIME_ZONE, currentZonedMonth } from '@/lib/bill/timezone';
import { groupBillsByDay } from '@/lib/bill/bill-group';
import {
  clearBillFilter,
  createInitialBillFilter,
  getBillFilterChips,
  hasRangeFilter,
  isBillFilterActive,
  removeBillFilter,
  resolveBillScope,
  submitBillKeyword,
  toBillFilterQuery,
  toStatisticsFilterQuery,
  type BillFilter,
  type BillFilterChipKey,
  type BillFilterLabels,
} from '@/lib/bill/bill-filters';
import { parseBillDrilldown, toBillFilterFromDrilldown } from '@/lib/bill/bill-drilldown';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { BillDayCard } from '@/components/bill/BillDayCard';
import { BillDetailContainer } from '@/components/bill/BillDetailContainer';
import { BillFilterSheet } from '@/components/bill/BillFilterSheet';
import { BillSearchBar } from '@/components/bill/BillSearchBar';
import { BillListSkeleton } from '@/components/skeleton/BillListSkeleton';
import { LedgerTopBar } from '@/components/bill/LedgerTopBar';
import { MonthSummaryCard } from '@/components/bill/MonthSummaryCard';
import { BillCreateSheet } from '@/components/bill/BillCreateSheet';
import { CreateBillFab } from '@/components/bill/CreateBillFab';
import { SyncStatusBar } from '@/components/mobile/SyncStatusBar';
import { useOfflineStore } from '@/store/offlineStore';
import { useUserAuthStore } from '@/store/userAuthStore';
import { matchesTransactionQuery } from '@/lib/offline/local-transaction';
import {
  isAccountListResponse,
  isCategoryListResponse,
  useCachedLedgerSnapshot,
  usePersistLedgerSnapshot,
} from '@/lib/offline/query-snapshot';
import { useOfflineTransactions } from '@/lib/offline/use-offline-transactions';
import {
  isTransactionListSnapshot,
  saveRecentTransactionSnapshot,
} from '@/lib/offline/storage';

const PAGE_SIZE = 30;

function monthShift(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** 参与了「筛选」计数的条件（关键词、付款人、记账人在搜索栏里独立呈现，不重复计数）。 */
function countSheetFilters(filter: BillFilter): number {
  return [
    filter.type,
    filter.categoryRootId || filter.categoryId || filter.uncategorized,
    filter.accountId,
    hasRangeFilter(filter) ? 'range' : '',
  ].filter(Boolean).length;
}

export function BillPageContent(): React.JSX.Element {
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const searchParams = useSearchParams();
  const drilldownKey = searchParams.toString();
  // 统计下钻通过 URL 进入首页；按账本和查询串重挂载，避免旧月份和旧筛选参与新请求。
  return (
    <BillPageLedger
      key={`${currentLedgerId ?? 'empty-ledger'}:${drilldownKey}`}
      currentLedgerId={currentLedgerId}
      searchParams={searchParams}
    />
  );
}

interface BillPageLedgerProps {
  currentLedgerId: string | null;
  searchParams: ReturnType<typeof useSearchParams>;
}

function BillPageLedger({ currentLedgerId, searchParams }: BillPageLedgerProps): React.JSX.Element {
  const router = useRouter();
  const now = React.useMemo(() => currentZonedMonth(new Date(), LEDGER_TIME_ZONE), []);
  const [selected, setSelected] = React.useState(now);
  // 首帧就带上 URL 里的下钻条件：否则会先按默认当月请求一次，再被覆盖成下钻范围。
  const [filter, setFilter] = React.useState<BillFilter>(() => {
    const drilldown = parseBillDrilldown(searchParams);
    return drilldown ? toBillFilterFromDrilldown(drilldown) : createInitialBillFilter();
  });
  const [keywordInput, setKeywordInput] = React.useState(
    () => parseBillDrilldown(searchParams)?.keyword ?? '',
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [detailBillId, setDetailBillId] = React.useState<string | null>(null);
  const isOnline = useOfflineStore((store) => store.isOnline);
  const pendingCount = useOfflineStore((store) => store.pendingCount);
  const syncStatus = useOfflineStore((store) => store.syncStatus);
  const requestSync = useOfflineStore((store) => store.requestSync);
  const currentUser = useUserAuthStore((store) => store.currentUser);
  const cachedCategories = useCachedLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId: currentLedgerId ?? '',
    kind: 'categories',
    guard: isCategoryListResponse,
  });
  const cachedAccounts = useCachedLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId: currentLedgerId ?? '',
    kind: 'accounts',
    guard: isAccountListResponse,
  });
  const cachedTransactions = useCachedLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId: currentLedgerId ?? '',
    kind: 'transactions',
    guard: isTransactionListSnapshot,
  });
  const localTransactions = useOfflineTransactions(currentUser?.id ?? null, currentLedgerId);

  const ledgerQuery = useQuery({
    queryKey: queryKeys.ledgers.detail(currentLedgerId ?? ''),
    queryFn: () => getLedger(currentLedgerId ?? ''),
    staleTime: queryStaleTime.ledgers,
    enabled: Boolean(currentLedgerId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.members(currentLedgerId ?? ''),
    queryFn: () => getLedgerMembers(currentLedgerId ?? ''),
    staleTime: queryStaleTime.members,
    enabled: Boolean(currentLedgerId),
  });

  // 筛选面板的分类与账户选项：只拉一次全量，列表页不再逐项请求。
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(currentLedgerId ?? ''),
    queryFn: () => getCategories(currentLedgerId ?? '', { pageSize: 100 }),
    staleTime: queryStaleTime.categories,
    enabled: Boolean(currentLedgerId),
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(currentLedgerId ?? ''),
    queryFn: () => getAccounts(currentLedgerId ?? '', { pageSize: 100 }),
    staleTime: queryStaleTime.accounts,
    enabled: Boolean(currentLedgerId),
  });

  usePersistLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId: currentLedgerId ?? '',
    kind: 'categories',
    data: categoriesQuery.data,
    recordCount: categoriesQuery.data?.items.length,
  });
  usePersistLedgerSnapshot({
    userId: currentUser?.id ?? null,
    ledgerId: currentLedgerId ?? '',
    kind: 'accounts',
    data: accountsQuery.data,
    recordCount: accountsQuery.data?.items.length,
  });

  // 账本时区来自服务端；未加载时退回全局默认值，避免第一帧用错日边界。
  const timeZone = ledgerQuery.data?.timezone || LEDGER_TIME_ZONE;
  const scope = React.useMemo(
    () => resolveBillScope(filter, selected, timeZone),
    [filter, selected, timeZone],
  );

  const members = React.useMemo(
    () =>
      membersQuery.data?.items.map((member) => ({
        id: member.userId,
        name: member.user.nickname?.trim() || member.user.username,
      })) ?? [],
    [membersQuery.data],
  );
  const categories = React.useMemo<CategorySummary[]>(
    () => categoriesQuery.data?.items ?? cachedCategories.data?.items ?? [],
    [cachedCategories.data, categoriesQuery.data],
  );
  const accounts = React.useMemo(
    () => accountsQuery.data?.items ?? cachedAccounts.data?.items ?? [],
    [cachedAccounts.data, accountsQuery.data],
  );

  const filterLabels = React.useMemo<BillFilterLabels>(
    () => ({
      members,
      categories,
      accounts: accounts.map((account) => ({ id: account.id, name: account.name })),
      timeZone,
    }),
    [members, categories, accounts, timeZone],
  );
  const filterChips = React.useMemo(
    () => getBillFilterChips(filter, filterLabels),
    [filter, filterLabels],
  );
  const isFiltered = isBillFilterActive(filter);

  const statisticsFilter = React.useMemo(() => toStatisticsFilterQuery(filter), [filter]);
  const listFilter = React.useMemo(() => toBillFilterQuery(filter), [filter]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.statistics.overview(currentLedgerId ?? '', {
      ...scope.statistics,
      ...statisticsFilter,
    }),
    queryFn: () =>
      getStatisticsOverview(currentLedgerId ?? '', { ...scope.statistics, ...statisticsFilter }),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(currentLedgerId),
  });

  const listQuery = useInfiniteQuery({
    // page 不进缓存键：否则每翻一页都会生成一个新键，`useInfiniteQuery` 无法复用同一份数据。
    queryKey: queryKeys.transactions.list(currentLedgerId ?? '', {
      pageSize: PAGE_SIZE,
      ...listFilter,
      from: scope.from,
      to: scope.to,
    }),
    queryFn: ({ pageParam }) =>
      getTransactions(currentLedgerId ?? '', {
        page: pageParam,
        pageSize: PAGE_SIZE,
        ...listFilter,
        from: scope.from,
        to: scope.to,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.page + 1 : undefined),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(currentLedgerId),
  });

  React.useEffect(() => {
    if (!currentUser?.id || !currentLedgerId || !listQuery.data?.pages.length) return;
    void (async () => {
      for (const page of listQuery.data?.pages ?? []) {
        await saveRecentTransactionSnapshot(currentUser.id, currentLedgerId, page);
      }
    })().catch(() => undefined);
  }, [currentLedgerId, currentUser?.id, listQuery.data]);

  const localQuery = React.useMemo(
    () => ({ ...listFilter, from: scope.from, to: scope.to }),
    [listFilter, scope.from, scope.to],
  );

  const bills = React.useMemo(
    () => {
      const serverBills = listQuery.data?.pages.flatMap((page) => page.items)
        ?? cachedTransactions.data?.items.filter((item) => matchesTransactionQuery(item, localQuery))
        ?? [];
      const localBills = localTransactions.filter((item) => matchesTransactionQuery(item, localQuery));
      const byId = new Map<string, typeof serverBills[number]>();
      for (const item of serverBills) byId.set(item.id, item);
      for (const item of localBills) byId.set(item.id, item);
      return [...byId.values()].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    },
    [cachedTransactions.data, listQuery.data, localQuery, localTransactions],
  );
  const localBillCount = localTransactions.filter((item) => matchesTransactionQuery(item, localQuery)).length;
  const total = listQuery.data
    ? (listQuery.data.pages[0]?.total ?? 0) + localBillCount
    : bills.length;
  const groups = React.useMemo(
    () => groupBillsByDay(bills, { timeZone }),
    [bills, timeZone],
  );

  const isLoading = Boolean(currentLedgerId)
    && listQuery.isPending
    && !listQuery.data
    && !cachedTransactions.data;
  const errorMessage =
    listQuery.isError && !listQuery.data && !cachedTransactions.data
      ? listQuery.error instanceof ApiRequestError
        ? listQuery.error.message
        : '账单加载失败，请稍后重试'
      : null;
  const isEmpty = !isLoading && !errorMessage && total === 0;

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listQuery;

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isCustomRange = scope.isCustomRange;
  const canGoNext =
    !isCustomRange && selected.year * 12 + selected.month < now.year * 12 + now.month;
  const goPrev = (): void => setSelected((value) => monthShift(value.year, value.month, -1));
  const goNext = (): void => {
    if (!canGoNext) return;
    setSelected((value) => monthShift(value.year, value.month, 1));
  };

  /** 自定义范围或下钻参数生效时，月份已不参与查询，清掉它们才能回到按月浏览。 */
  const clearRangeWithUrl = (): void => {
    setFilter((value) => removeBillFilter(value, 'range'));
    if (searchParams.toString()) router.replace('/user');
  };

  const handleRemove = (key: BillFilterChipKey): void => {
    if (key === 'range') {
      clearRangeWithUrl();
      return;
    }
    setFilter((value) => removeBillFilter(value, key));
    if (key === 'keyword') setKeywordInput('');
  };

  const handleClear = (): void => {
    setFilter(createInitialBillFilter());
    setKeywordInput('');
    if (searchParams.toString()) router.replace('/user');
  };

  return (
    <div className="select-none">
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <LedgerTopBar
          ledgerName={currentLedgerId ? (ledgerQuery.data?.name ?? null) : null}
          year={selected.year}
          month={selected.month}
          // 自定义范围优先于月份导航：此时两个箭头都不再改变查询边界。
          canGoPrev={!isCustomRange}
          canGoNext={canGoNext}
          onPrevMonth={goPrev}
          onNextMonth={goNext}
          onOpenLedgerPicker={() => router.push('/user/ledgers')}
        />

        <SyncStatusBar
          isOnline={isOnline}
          pendingCount={pendingCount}
          isSyncing={syncStatus === 'syncing'}
          hasConflict={syncStatus === 'failed' || syncStatus === 'conflict'}
          onRetry={requestSync}
        />
        {!isOnline && cachedTransactions.updatedAt && (
          <p className="px-1 text-[11px] text-text-tertiary">
            当前显示最近缓存的账单：{new Date(cachedTransactions.updatedAt).toLocaleString('zh-CN')}
          </p>
        )}

        <BillSearchBar
          keyword={keywordInput}
          payerId={filter.payerId}
          createdById={filter.createdById}
          members={members}
          chips={filterChips}
          isFiltered={isFiltered}
          activeFilterCount={countSheetFilters(filter)}
          onKeywordChange={setKeywordInput}
          onSubmitKeyword={() => setFilter((value) => submitBillKeyword(value, keywordInput))}
          onPayerChange={(payerId) => setFilter((value) => ({ ...value, payerId }))}
          onCreatedByIdChange={(createdById) =>
            setFilter((value) => ({ ...value, createdById }))
          }
          onOpenFilter={() => setFilterOpen(true)}
          onClear={handleClear}
          onRemove={handleRemove}
        />

        {isLoading && <BillListSkeleton />}

        {!isLoading && errorMessage && (
          <section
            role="alert"
            className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"
          >
            <p className="text-sm">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void listQuery.refetch()}
              className="gap-1.5 border-rose-200"
            >
              <RefreshCw size={14} />
              重新加载
            </Button>
          </section>
        )}

        {!isLoading && !errorMessage && (
          <>
            <MonthSummaryCard
              overview={overviewQuery.data}
              isFiltered={isFiltered}
              isCustomRange={isCustomRange}
              rangeLabel={scope.rangeLabel}
            />

            {isCustomRange && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-app-border bg-app-card px-3 py-2">
                <p className="min-w-0 truncate text-[11px] text-text-muted">
                  自定义时间范围：{scope.rangeLabel ?? '全部'}
                </p>
                <button
                  type="button"
                  onClick={clearRangeWithUrl}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-card-subtle px-2.5 py-1 text-[11px] text-text-main"
                >
                  <X size={12} />
                  清除时间范围
                </button>
              </div>
            )}

            {isEmpty && (
              <section className="rounded-3xl border border-dashed border-app-border bg-app-card px-6 py-12 text-center">
                <ReceiptText className="mx-auto size-10 text-text-muted/40" />
                <h2 className="mt-4 text-base font-semibold text-text-main">
                  {isFiltered ? '没有符合条件的账单' : '还没有账单'}
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  {isFiltered ? '可以调整筛选条件，或清除筛选查看全部记录。' : '这个账本还没有收支记录。'}
                </p>
                {isFiltered && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleClear}
                  >
                    清除筛选
                  </Button>
                )}
              </section>
            )}

            {groups.map((group) => (
              <BillDayCard
                key={group.billDate}
                group={group}
                onSelectBill={(bill) => setDetailBillId(bill.id)}
              />
            ))}

            <div ref={sentinelRef} className="flex justify-center py-2">
              {isFetchingNextPage && <Loader2 className="size-4 animate-spin text-text-muted" />}
              {!hasNextPage && groups.length > 0 && (
                <span className="text-xs text-text-tertiary">没有更多账单</span>
              )}
            </div>
          </>
        )}
      </main>

      <CreateBillFab
        memberRole={ledgerQuery.data?.memberRole}
        onClick={() => setCreateOpen(true)}
      />

      <BillFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        initial={filter}
        categories={categories}
        accounts={accounts}
        members={members}
        isLoadingOptions={categoriesQuery.isPending || accountsQuery.isPending}
        timeZone={timeZone}
        today={new Date().toLocaleDateString('en-CA', { timeZone })}
        onApply={(next) => setFilter(next)}
        onClear={handleClear}
      />

      {currentLedgerId && (
        <BillDetailContainer
          open={detailBillId !== null}
          onOpenChange={(next) => {
            if (!next) setDetailBillId(null);
          }}
          ledgerId={currentLedgerId}
          billId={detailBillId}
          memberRole={ledgerQuery.data?.memberRole}
          onDeleted={() => setDetailBillId(null)}
        />
      )}

      {currentLedgerId && (
        <BillCreateSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          ledgerId={currentLedgerId}
          ledgerName={ledgerQuery.data?.name ?? null}
          memberRole={ledgerQuery.data?.memberRole}
          onCreated={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}
