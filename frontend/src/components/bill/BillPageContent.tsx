'use client';

import * as React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, ReceiptText } from 'lucide-react';
import { getStatisticsOverview, getTransactions } from '@/lib/api/transaction-api';
import { ApiRequestError } from '@/lib/api/errors';
import { getLedger } from '@/lib/api/ledger-api';
import { getLedgerMembers } from '@/lib/api/member-api';
import { LEDGER_TIME_ZONE, currentZonedMonth, zonedMonthBoundary } from '@/lib/bill/timezone';
import { groupBillsByDay } from '@/lib/bill/bill-group';
import {
  clearBillFilter,
  createInitialBillFilter,
  getBillFilterChips,
  isBillFilterActive,
  removeBillFilter,
  submitBillKeyword,
  toBillFilterQuery,
  type BillFilter,
} from '@/lib/bill/bill-filters';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { BillDayCard } from '@/components/bill/BillDayCard';
import { BillDetailContainer } from '@/components/bill/BillDetailContainer';
import { BillSearchBar } from '@/components/bill/BillSearchBar';
import { BillListSkeleton } from '@/components/skeleton/BillListSkeleton';
import { LedgerTopBar } from '@/components/bill/LedgerTopBar';
import { MonthSummaryCard } from '@/components/bill/MonthSummaryCard';
import { BillCreateSheet } from '@/components/bill/BillCreateSheet';
import { CreateBillFab } from '@/components/bill/CreateBillFab';
import { SyncStatusBar } from '@/components/mobile/SyncStatusBar';
import { useOfflineStore } from '@/store/offlineStore';

const PAGE_SIZE = 30;

function monthShift(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function BillPageContent(): React.JSX.Element {
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  return <BillPageLedger key={currentLedgerId ?? 'empty-ledger'} currentLedgerId={currentLedgerId} />;
}

interface BillPageLedgerProps {
  currentLedgerId: string | null;
}

function BillPageLedger({ currentLedgerId }: BillPageLedgerProps): React.JSX.Element {
  const now = React.useMemo(() => currentZonedMonth(new Date(), LEDGER_TIME_ZONE), []);
  const [selected, setSelected] = React.useState(now);
  const [filter, setFilter] = React.useState<BillFilter>(createInitialBillFilter);
  const [keywordInput, setKeywordInput] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailBillId, setDetailBillId] = React.useState<string | null>(null);
  const isOnline = useOfflineStore((store) => store.isOnline);

  const range = React.useMemo(
    () => ({
      from: zonedMonthBoundary(selected.year, selected.month, LEDGER_TIME_ZONE),
      to: zonedMonthBoundary(selected.year, selected.month + 1, LEDGER_TIME_ZONE),
    }),
    [selected],
  );

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

  const filterQuery = React.useMemo(() => toBillFilterQuery(filter), [filter]);
  const members = React.useMemo(
    () =>
      membersQuery.data?.items.map((member) => ({
        id: member.userId,
        name: member.user.nickname?.trim() || member.user.username,
      })) ?? [],
    [membersQuery.data],
  );
  const filterChips = React.useMemo(
    () => getBillFilterChips(filter, members),
    [filter, members],
  );
  const isFiltered = isBillFilterActive(filter);

  const overviewQuery = useQuery({
    queryKey: queryKeys.statistics.overview(currentLedgerId ?? '', { ...range, ...filterQuery }),
    queryFn: () => getStatisticsOverview(currentLedgerId ?? '', { ...range, ...filterQuery }),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(currentLedgerId),
  });

  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.transactions.list(currentLedgerId ?? '', {
      ...range,
      ...filterQuery,
      pageSize: PAGE_SIZE,
    }),
    queryFn: ({ pageParam }) =>
      getTransactions(currentLedgerId ?? '', {
        ...range,
        ...filterQuery,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.page + 1 : undefined),
    staleTime: queryStaleTime.transactions,
    enabled: Boolean(currentLedgerId),
  });

  const bills = React.useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total ?? 0;
  const groups = React.useMemo(() => groupBillsByDay(bills, { timeZone: LEDGER_TIME_ZONE }), [bills]);

  const isLoading = Boolean(currentLedgerId) && listQuery.isPending && !listQuery.data;
  const errorMessage =
    listQuery.isError && !listQuery.data
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

  const canGoNext = selected.year * 12 + selected.month < now.year * 12 + now.month;
  const goPrev = (): void => setSelected((value) => monthShift(value.year, value.month, -1));
  const goNext = (): void => {
    if (!canGoNext) return;
    setSelected((value) => monthShift(value.year, value.month, 1));
  };

  return (
    <div className="select-none">
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <LedgerTopBar
          ledgerName={currentLedgerId ? (ledgerQuery.data?.name ?? null) : null}
          year={selected.year}
          month={selected.month}
          canGoNext={canGoNext}
          onPrevMonth={goPrev}
          onNextMonth={goNext}
        />

        <SyncStatusBar isOnline={isOnline} />

        <BillSearchBar
          keyword={keywordInput}
          payerId={filter.payerId}
          members={members}
          chips={filterChips}
          isFiltered={isFiltered}
          onKeywordChange={setKeywordInput}
          onSubmitKeyword={() => setFilter((value) => submitBillKeyword(value, keywordInput))}
          onPayerChange={(payerId) => setFilter((value) => ({ ...value, payerId }))}
          onClear={() => {
            setFilter((value) => clearBillFilter(value));
            setKeywordInput('');
          }}
          onRemove={(key) => {
            setFilter((value) => removeBillFilter(value, key));
            if (key === 'keyword') setKeywordInput('');
          }}
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
              isPartiallyFiltered={false}
            />

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
                    onClick={() => {
                      setFilter((value) => clearBillFilter(value));
                      setKeywordInput('');
                    }}
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
