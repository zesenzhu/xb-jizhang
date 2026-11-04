import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { StatisticsOverview } from '@/lib/api/transaction-types';

export interface MonthSummaryCardProps {
  /** 服务端聚合结果；未加载时为 undefined，渲染骨架数值 */
  overview: StatisticsOverview | undefined;
  /** 当前是否处于筛选状态，用于展示「筛选结果」标记 */
  isFiltered: boolean;
  /** 关键词/付款人条件下服务端聚合未纳入对应筛选 */
  isPartiallyFiltered: boolean;
  className?: string;
}

export function MonthSummaryCard({
  overview,
  isFiltered,
  isPartiallyFiltered,
  className,
}: MonthSummaryCardProps): React.JSX.Element {
  const expenseText = formatCentsToYuan(overview?.totalExpenseCents ?? 0);
  const incomeText = formatCentsToYuan(overview?.totalIncomeCents ?? 0);
  const netCents = overview?.netCents ?? 0;
  const netText = `${netCents < 0 ? '-' : ''}¥${formatCentsToYuan(Math.abs(netCents))}`;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl bg-[#16181d] p-5 text-white shadow-xl shadow-slate-900/10 border border-white/10',
        className,
      )}
    >
      {isFiltered && (
        <span className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
          筛选结果
        </span>
      )}

      <p className="text-xs font-medium text-white/60">总支出</p>
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
          <p className="text-xs text-white/60">月结余</p>
          <p className={cn('mt-1 font-mono text-base font-semibold', netCents < 0 ? 'text-rose-400' : 'text-white')}>
            {overview ? netText : '—'}
          </p>
        </div>
      </div>

      {isPartiallyFiltered && (
        <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-white/50">
          概览未包含关键词或付款人条件，数值可能与列表不一致。
        </p>
      )}
    </section>
  );
}
