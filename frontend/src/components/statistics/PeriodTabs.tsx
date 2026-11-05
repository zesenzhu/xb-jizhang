'use client';

import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { StatisticsPeriod } from '@/lib/api/statistics-types';
import { canGoNext, formatAnchorLabel } from '@/lib/statistics/range';

export interface PeriodTabsProps {
  value: StatisticsPeriod;
  onChange: (period: StatisticsPeriod) => void;
  className?: string;
}

const PERIODS = [
  { key: 'WEEK', label: '周' },
  { key: 'MONTH', label: '月' },
  { key: 'YEAR', label: '年' },
  { key: 'ALL', label: '全部' },
  { key: 'RANGE', label: '范围' },
] as const;

/** 时间维度分段器。默认「月」，与需求 9.2 一致。 */
export function PeriodTabs({ value, onChange, className }: PeriodTabsProps): React.JSX.Element {
  return (
    <div className={cn('flex rounded-full bg-app-card-subtle p-1', className)} role="tablist">
      {PERIODS.map((period) => (
        <button
          key={period.key}
          type="button"
          role="tab"
          aria-selected={value === period.key}
          onClick={() => onChange(period.key)}
          className={cn(
            'flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors',
            value === period.key
              ? 'bg-app-card text-text-main shadow-xs'
              : 'text-text-muted',
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

export interface RangeNavigatorProps {
  period: StatisticsPeriod;
  anchorDate: string;
  today: string;
  onShift: (delta: number) => void;
  className?: string;
}

/**
 * 时间导航。
 *
 * `ALL` 与 `RANGE` 不显示左右箭头：前者没有边界，后者由日期选择器控制。
 * 未来周期禁用：`canGoNext` 与需求 9.2 的「不允许导航到未来统计周期」对应。
 */
export function RangeNavigator({
  period,
  anchorDate,
  today,
  onShift,
  className,
}: RangeNavigatorProps): React.JSX.Element | null {
  if (period === 'RANGE') return null;

  const showArrows = period !== 'ALL';
  const nextEnabled = showArrows && canGoNext(period, anchorDate, today);

  return (
    <div className={cn('flex items-center justify-between px-1 py-2', className)}>
      {showArrows ? (
        <button
          type="button"
          onClick={() => onShift(-1)}
          aria-label="上一周期"
          className="flex size-8 items-center justify-center rounded-full bg-app-card-subtle text-text-muted active:scale-95"
        >
          ‹
        </button>
      ) : (
        <span className="size-8" />
      )}

      <span className="text-sm font-semibold text-text-main">
        {period === 'ALL' ? '全部时间' : formatAnchorLabel(period, anchorDate)}
      </span>

      {showArrows ? (
        <button
          type="button"
          onClick={() => onShift(1)}
          disabled={!nextEnabled}
          aria-label="下一周期"
          className="flex size-8 items-center justify-center rounded-full bg-app-card-subtle text-text-muted active:scale-95 disabled:opacity-30"
        >
          ›
        </button>
      ) : (
        <span className="size-8" />
      )}
    </div>
  );
}

export interface OverviewCardsProps {
  totalExpenseCents: number;
  totalIncomeCents: number;
  netCents: number;
  averageDailyExpenseCents: number;
  onSelectExpense?: () => void;
  onSelectIncome?: () => void;
  className?: string;
}

/** 四项概览。结余不是账户余额，日均支出按有效自然日计算（服务端口径）。 */
export function OverviewCards({
  totalExpenseCents,
  totalIncomeCents,
  netCents,
  averageDailyExpenseCents,
  onSelectExpense,
  onSelectIncome,
  className,
}: OverviewCardsProps): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <OverviewCell
        label="支出"
        value={totalExpenseCents}
        tone="expense"
        onClick={onSelectExpense}
      />
      <OverviewCell
        label="收入"
        value={totalIncomeCents}
        tone="income"
        onClick={onSelectIncome}
      />
      <OverviewCell label="结余" value={netCents} tone="neutral" signed />
      <OverviewCell label="日均支出" value={averageDailyExpenseCents} tone="neutral" />
    </div>
  );
}

function OverviewCell({
  label,
  value,
  tone,
  signed = false,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'expense' | 'income' | 'neutral';
  signed?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  const content = (
    <>
      <span className="text-[11px] text-text-muted">{label}</span>
      <span
        className={cn(
          'mt-0.5 font-mono text-lg font-bold tabular-nums',
          tone === 'expense'
            ? 'text-rose-500'
            : tone === 'income'
              ? 'text-emerald-600'
              : value < 0
                ? 'text-rose-500'
                : 'text-text-main',
        )}
      >
        {signed && value > 0 ? '+' : ''}
        ¥{formatCentsToYuan(value)}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col rounded-2xl bg-app-card-subtle/70 px-3 py-2 text-left active:scale-[0.99]"
      >
        {content}
      </button>
    );
  }

  return <div className="flex flex-col rounded-2xl bg-app-card-subtle/70 px-3 py-2">{content}</div>;
}
