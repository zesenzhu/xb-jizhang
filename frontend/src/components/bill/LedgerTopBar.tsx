import * as React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LedgerTopBarProps {
  /** 账本名称；未加载时传 null，渲染占位骨架 */
  ledgerName: string | null;
  /** 当前统计月份，1-12 */
  month: number;
  year: number;
  /** 是否允许前进到下一月；当前月及以后为 false */
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** 账本切换入口；一期未实现切换面板时省略，标题渲染为纯文本 */
  onOpenLedgerPicker?: () => void;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function LedgerTopBar({
  ledgerName,
  month,
  year,
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
          className="flex w-full items-center gap-2 text-left"
          aria-label="切换账本"
        >
          <h1 className="truncate text-2xl font-bold tracking-tight text-text-main">
            {ledgerName ?? <span className="inline-block h-7 w-32 animate-pulse rounded-md bg-app-card-subtle" />}
          </h1>
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
            aria-label="上一月"
            className="flex size-7 items-center justify-center rounded-full bg-app-card-subtle text-text-muted transition-colors active:scale-95 hover:text-text-main"
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
