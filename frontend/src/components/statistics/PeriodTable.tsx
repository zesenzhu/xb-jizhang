'use client';

import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { PeriodItem, PeriodSummary } from '@/lib/api/statistics-types';
import { formatPeriodLabel } from '@/lib/statistics/chart';

export interface PeriodTableProps {
  summary: PeriodSummary;
  items: readonly PeriodItem[];
  granularity: 'DAY' | 'MONTH' | 'YEAR';
  onSelectPeriod?: (item: PeriodItem) => void;
  className?: string;
}

/**
 * 账单汇总表。
 *
 * 行由服务端返回且包含连续零值周期，前端不裁剪、不补行：
 * 需求 9.6 要求「默认不隐藏时间上连续的空周期，以便对照周期」。
 * 总计取服务端 `summary`，不做前端累加。
 */
export function PeriodTable({
  summary,
  items,
  granularity,
  onSelectPeriod,
  className,
}: PeriodTableProps): React.JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-app-border', className)}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-app-card-subtle text-[11px] text-text-muted">
            <th className="px-3 py-2 text-left font-medium">日期</th>
            <th className="px-2 py-2 text-right font-medium">支出</th>
            <th className="px-2 py-2 text-right font-medium">收入</th>
            <th className="px-3 py-2 text-right font-medium">结余</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-app-divider bg-app-card">
            <td className="px-3 py-2 font-semibold text-text-main">总计</td>
            <td className="px-2 py-2 text-right tabular-nums text-rose-500">
              ¥{formatCentsToYuan(summary.totalExpenseCents)}
            </td>
            <td className="px-2 py-2 text-right tabular-nums text-emerald-600">
              ¥{formatCentsToYuan(summary.totalIncomeCents)}
            </td>
            <td
              className={cn(
                'px-3 py-2 text-right tabular-nums font-semibold',
                summary.netCents < 0 ? 'text-rose-500' : 'text-text-main',
              )}
            >
              ¥{formatCentsToYuan(summary.netCents)}
            </td>
          </tr>

          <tr className="border-t border-app-divider bg-app-card text-text-muted">
            <td className="px-3 py-2">日均</td>
            <td className="px-2 py-2 text-right tabular-nums">
              ¥{formatCentsToYuan(summary.averageDailyExpenseCents)}
            </td>
            <td className="px-2 py-2 text-right tabular-nums">—</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {summary.effectiveDayCount > 0
                ? `¥${formatCentsToYuan(
                    Math.round(summary.netCents / summary.effectiveDayCount),
                  )}`
                : '¥0.00'}
            </td>
          </tr>

          {items.map((item) => (
            <tr
              key={`${item.fromDate}-${item.toDate}`}
              onClick={() => onSelectPeriod?.(item)}
              className="cursor-pointer border-t border-app-divider bg-app-card transition-colors active:bg-app-card-subtle/60"
            >
              <td className="px-3 py-2 text-text-main">
                {formatPeriodLabel(item.fromDate, item.toDate, granularity)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-main">
                ¥{formatCentsToYuan(item.expenseCents)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-main">
                ¥{formatCentsToYuan(item.incomeCents)}
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-right tabular-nums',
                  item.netCents < 0 ? 'text-rose-500' : 'text-text-main',
                )}
              >
                ¥{formatCentsToYuan(item.netCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <p className="border-t border-app-divider px-3 py-6 text-center text-xs text-text-tertiary">
          当前范围内没有账单
        </p>
      )}
    </div>
  );
}
