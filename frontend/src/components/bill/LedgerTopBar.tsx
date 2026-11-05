import * as React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LedgerTopBarProps {
  ledgerName: string | null;
  month: number;
  year: number;
  /** 是否允许后退到上一月；自定义时间范围生效时由调用方置为 false */
  canGoPrev?: boolean;
  /** 是否允许前进到下一月；当前月及以后为 false */
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenLedgerPicker?: () => void;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function LedgerTopBar({
  ledgerName,
  month,
  year,
  canGoPrev = true,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onOpenLedgerPicker,
}: LedgerTopBarProps): React.JSX.Element {
  return (
    <header className="space-y-3">
      {onOpenLedgerPicker ? (
        <button
          type="button"
          onClick={onOpenLedgerPicker}
          className="flex w-full items-center gap-2 text-left rounded-xl transition-colors hover:bg-app-card-subtle px-1 -ml-1"
          aria-label="切换账本"
        >
          <h1 className="truncate text-2xl font-bold tracking-tight text-text-main">
            {ledgerName ?? <span className="inline-block h-7 w-32 animate-pulse rounded-md bg-app-card-subtle" />}
          </h1>
          <span className="text-sm font-medium text-text-muted">切换</span>
          <ChevronRight size={18} className="shrink-0 text-text-muted" />
        </button>
      ) : (
        <h1 className="truncate text-2xl font-bold tracking-tight text-text-main">
          {ledgerName ?? <span className="inline-block h-7 w-32 animate-pulse rounded-md bg-app-card-subtle" />}
        </h1>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-text-main">
            {year}年{MONTH_LABELS[month - 1]}
          </span>
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={!canGoPrev}
            aria-label="上一月"
            className={cn(
              'flex size-7 items-center justify-center rounded-full bg-app-card-subtle text-text-muted transition-colors active:scale-95',
              canGoPrev ? 'hover:text-text-main' : 'opacity-40',
            )}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={!canGoNext}
            aria-label="下一月"
            className={cn(
              'flex size-7 items-center justify-center rounded-full bg-app-card-subtle text-text-muted transition-colors active:scale-95',
              canGoNext ? 'hover:text-text-main' : 'opacity-40',
            )}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-app-card-subtle px-3 py-1.5 text-xs text-text-muted">
          <CalendarDays size={13} />
          收支日历
        </span>
      </div>
    </header>
  );
}
