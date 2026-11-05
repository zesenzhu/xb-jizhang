'use client';

import * as React from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CategorySummary } from '@/lib/api/category-types';
import type { AccountSummary } from '@/lib/api/account-types';
import type {
  BillFilter,
  BillFilterMember,
  BillFilterType,
} from '@/lib/bill/bill-filters';
import {
  billFilterDates,
  withBillFilterDates,
} from '@/lib/bill/bill-filters';

export interface BillFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: BillFilter;
  categories: readonly CategorySummary[];
  accounts: readonly AccountSummary[];
  members: readonly BillFilterMember[];
  isLoadingOptions: boolean;
  timeZone: string;
  today: string;
  onApply: (next: BillFilter) => void;
  onClear: () => void;
}

export function BillFilterSheet({
  open,
  onOpenChange,
  initial,
  categories,
  accounts,
  members: _members,
  isLoadingOptions,
  timeZone,
  today,
  onApply,
  onClear,
}: BillFilterSheetProps): React.JSX.Element {
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [draft, setDraft] = React.useState<BillFilter>(initial);
  const [dates, setDates] = React.useState<{ fromDate: string; toDate: string }>({
    fromDate: '',
    toDate: '',
  });

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(initial);
      setDates(billFilterDates(initial, timeZone));
    }
  }

  const hasOnlyOneDate =
    (Boolean(dates.fromDate) && !dates.toDate) || (!dates.fromDate && Boolean(dates.toDate));
  const isStartAfterEnd = Boolean(
    dates.fromDate && dates.toDate && dates.fromDate > dates.toDate,
  );
  const hasRangeError = hasOnlyOneDate || isStartAfterEnd;
  const rangeErrorText = isStartAfterEnd
    ? '结束日期不能早于开始日期'
    : hasOnlyOneDate
      ? '请选择完整的起止日期'
      : null;

  const handleApply = (): void => {
    if (hasRangeError) return;
    const nextFilter = withBillFilterDates(draft, dates, timeZone);
    onApply(nextFilter);
    onOpenChange(false);
  };

  const handleClear = (): void => {
    onClear();
    onOpenChange(false);
  };

  const activeCategories = React.useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories],
  );

  const expenseRoots = React.useMemo(
    () =>
      activeCategories
        .filter((c) => c.type === 'EXPENSE' && !c.parentId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [activeCategories],
  );

  const incomeRoots = React.useMemo(
    () =>
      activeCategories
        .filter((c) => c.type === 'INCOME' && !c.parentId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [activeCategories],
  );

  const getChildren = (rootId: string) =>
    activeCategories
      .filter((c) => c.parentId === rootId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const selectedCategoryValue = React.useMemo(() => {
    if (draft.categoryId) {
      return `child:${draft.categoryId}`;
    }
    if (draft.categoryRootId) {
      return `root:${draft.categoryRootId}`;
    }
    return '';
  }, [draft.categoryId, draft.categoryRootId]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value;
    if (!val) {
      setDraft((prev) => ({ ...prev, categoryRootId: '', categoryId: '' }));
      return;
    }
    if (val.startsWith('root:')) {
      const rootId = val.slice(5);
      setDraft((prev) => ({ ...prev, categoryRootId: rootId, categoryId: '' }));
    } else if (val.startsWith('child:')) {
      const childId = val.slice(6);
      setDraft((prev) => ({ ...prev, categoryRootId: '', categoryId: childId }));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="筛选账单"
      variant="full"
      className="max-w-md mx-auto"
    >
      <div className="flex flex-col gap-5 px-4 pt-2 pb-6">
        <section aria-labelledby="filter-type-heading" className="space-y-2">
          <span
            id="filter-type-heading"
            className="block text-xs font-semibold text-text-muted"
          >
            交易类型
          </span>
          <div
            role="group"
            aria-label="交易类型选择"
            className="flex rounded-2xl bg-app-card-subtle p-1 border border-app-border/40"
          >
            {(
              [
                { label: '全部', value: '' as BillFilterType },
                { label: '支出', value: 'EXPENSE' as BillFilterType },
                { label: '收入', value: 'INCOME' as BillFilterType },
              ] as const
            ).map((tab) => {
              const active = (draft.type ?? '') === tab.value;
              return (
                <button
                  key={tab.value || 'ALL'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft((prev) => ({ ...prev, type: tab.value }))}
                  className={cn(
                    'flex-1 rounded-xl py-2 text-xs font-medium transition-all active:scale-[0.98]',
                    active
                      ? 'bg-app-card text-text-main shadow-xs font-semibold border border-app-border/30'
                      : 'text-text-muted hover:text-text-main',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="filter-category-heading" className="space-y-2">
          <label
            id="filter-category-heading"
            htmlFor="filter-category-select"
            className="block text-xs font-semibold text-text-muted"
          >
            分类
          </label>
          {isLoadingOptions ? (
            <Skeleton className="h-11 w-full rounded-2xl" />
          ) : (
            <select
              id="filter-category-select"
              aria-label="分类"
              value={selectedCategoryValue}
              onChange={handleCategoryChange}
              className="h-11 w-full rounded-2xl border border-app-border bg-app-card px-3 text-sm text-text-main outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">全部分类</option>
              {expenseRoots.length > 0 && (
                <optgroup label="支出分类">
                  {expenseRoots.map((root) => {
                    const children = getChildren(root.id);
                    return (
                      <React.Fragment key={root.id}>
                        <option value={`root:${root.id}`}>全部 {root.name}</option>
                        {children.map((child) => (
                          <option key={child.id} value={`child:${child.id}`}>
                            — {child.name}
                          </option>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </optgroup>
              )}
              {incomeRoots.length > 0 && (
                <optgroup label="收入分类">
                  {incomeRoots.map((root) => {
                    const children = getChildren(root.id);
                    return (
                      <React.Fragment key={root.id}>
                        <option value={`root:${root.id}`}>全部 {root.name}</option>
                        {children.map((child) => (
                          <option key={child.id} value={`child:${child.id}`}>
                            — {child.name}
                          </option>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </optgroup>
              )}
            </select>
          )}
        </section>

        <section aria-labelledby="filter-account-heading" className="space-y-2">
          <label
            id="filter-account-heading"
            htmlFor="filter-account-select"
            className="block text-xs font-semibold text-text-muted"
          >
            账户
          </label>
          {isLoadingOptions ? (
            <Skeleton className="h-11 w-full rounded-2xl" />
          ) : (
            <select
              id="filter-account-select"
              aria-label="账户"
              value={draft.accountId}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, accountId: e.target.value }))
              }
              className="h-11 w-full rounded-2xl border border-app-border bg-app-card px-3 text-sm text-text-main outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">全部账户</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          )}
        </section>

        <section aria-labelledby="filter-date-heading" className="space-y-2">
          <span
            id="filter-date-heading"
            className="block text-xs font-semibold text-text-muted"
          >
            日期范围
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label htmlFor="filter-start-date" className="sr-only">
                开始日期
              </label>
              <input
                id="filter-start-date"
                type="date"
                max={today}
                aria-label="开始日期"
                value={dates.fromDate}
                onChange={(e) =>
                  setDates((prev) => ({ ...prev, fromDate: e.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-app-border bg-app-card px-3 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <span className="shrink-0 text-xs text-text-tertiary">至</span>
            <div className="flex-1 space-y-1">
              <label htmlFor="filter-end-date" className="sr-only">
                结束日期
              </label>
              <input
                id="filter-end-date"
                type="date"
                max={today}
                aria-label="结束日期"
                value={dates.toDate}
                onChange={(e) =>
                  setDates((prev) => ({ ...prev, toDate: e.target.value }))
                }
                className="h-11 w-full rounded-2xl border border-app-border bg-app-card px-3 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          {rangeErrorText && (
            <p role="alert" className="text-xs text-rose-500">
              {rangeErrorText}
            </p>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-app-border bg-app-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20"
            onClick={handleClear}
          >
            清除全部
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={hasRangeError}
            onClick={handleApply}
          >
            应用
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
