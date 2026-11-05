import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { OverviewData } from '@/lib/api/statistics-types';

export interface MonthSummaryCardProps {
  overview: OverviewData | undefined;
  isFiltered: boolean;
  isCustomRange: boolean;
  rangeLabel: string | null;
  className?: string;
}

export function MonthSummaryCard({
  overview,
  isFiltered,
  isCustomRange,
  rangeLabel,
  className,
}: MonthSummaryCardProps): React.JSX.Element {
  const expenseText = formatCentsToYuan(overview?.totalExpenseCents ?? 0);
  const incomeText = formatCentsToYuan(overview?.totalIncomeCents ?? 0);
  const netCents = overview?.netCents ?? 0;
  const netText = `${netCents < 0 ? '-' : ''}¥${formatCentsToYuan(Math.abs(netCents))}`;
  const avgExpenseText = formatCentsToYuan(overview?.averageDailyExpenseCents ?? 0);
  const effectiveDayCount = overview?.effectiveDayCount ?? 0;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl bg-[#16181d] p-5 text-white shadow-xl shadow-slate-900/10 border border-white/10',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white/60">总支出</p>
        <div className="flex items-center gap-1.5">
          {isCustomRange && rangeLabel && (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-white/70">
              {rangeLabel}
            </span>
          )}
          {isFiltered && (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
              筛选结果
            </span>
          )}
        </div>
      </div>

      {overview ? (
        <p className="mt-1 font-mono text-3xl font-bold tracking-tight">¥{expenseText}</p>
      ) : (
        <div className="mt-2 h-8 w-36 animate-pulse rounded-md bg-white/10" />
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
        <div>
          <p className="text-xs text-white/60">总收入</p>
          <p className="mt-1 font-mono text-base font-semibold text-emerald-400">
            {overview ? `¥${incomeText}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/60">结余</p>
          <p className={cn('mt-1 font-mono text-base font-semibold', netCents < 0 ? 'text-rose-400' : 'text-white')}>
            {overview ? netText : '—'}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="text-xs text-white/70">
          日均支出 ¥{overview ? avgExpenseText : '—'} · 有效 {effectiveDayCount} 天
        </p>
      </div>
    </section>
  );
}
