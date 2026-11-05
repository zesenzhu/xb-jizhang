'use client';

import * as React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  BillFilterChip,
  BillFilterChipKey,
  BillFilterMember,
} from '@/lib/bill/bill-filters';

export interface BillSearchBarProps {
  keyword: string;
  payerId: string;
  members: readonly BillFilterMember[];
  chips: readonly BillFilterChip[];
  isFiltered: boolean;
  activeFilterCount: number;
  onKeywordChange: (keyword: string) => void;
  onSubmitKeyword: () => void;
  onPayerChange: (payerId: string) => void;
  onOpenFilter: () => void;
  onClear: () => void;
  onRemove: (key: BillFilterChipKey) => void;
}

export function BillSearchBar({
  keyword,
  payerId,
  members,
  chips,
  isFiltered,
  activeFilterCount,
  onKeywordChange,
  onSubmitKeyword,
  onPayerChange,
  onOpenFilter,
  onClear,
  onRemove,
}: BillSearchBarProps): React.JSX.Element {
  return (
    <section className="space-y-2" aria-label="账单搜索与筛选">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitKeyword();
        }}
      >
        <Input
          aria-label="搜索账单"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="搜索标题或备注"
          startIcon={<Search size={16} />}
        />
        <Button type="submit" size="icon" aria-label="搜索" className="shrink-0">
          <Search size={17} />
        </Button>
      </form>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="bill-payer-filter">
          实际付款人
        </label>
        <select
          id="bill-payer-filter"
          aria-label="实际付款人"
          value={payerId}
          onChange={(event) => onPayerChange(event.target.value)}
          className="h-9 min-w-28 rounded-xl border border-app-border bg-app-card px-3 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">全部付款人</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenFilter}
          aria-label="打开筛选面板"
          className="gap-1.5 rounded-xl border-app-border px-3 text-xs text-text-main"
        >
          <SlidersHorizontal size={14} className="text-text-muted" />
          {activeFilterCount > 0 ? `筛选·${activeFilterCount}` : '筛选'}
        </Button>

        {isFiltered && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto gap-1 text-xs text-text-muted hover:text-text-main"
            onClick={onClear}
          >
            <X size={14} />
            清除全部
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="已生效筛选条件">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onRemove(chip.key)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/15"
              aria-label={`移除${chip.label}`}
            >
              {chip.label}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
