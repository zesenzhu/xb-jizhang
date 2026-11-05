'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { TrendItem, TrendMetric } from '@/lib/api/statistics-types';
import { formatCompactYuan, formatPeriodLabel, hasNegative, toTrendPoints } from '@/lib/statistics/chart';
import type { StatisticsGranularity } from '@/lib/api/statistics-types';

export interface TrendChartProps {
  items: readonly TrendItem[];
  metric: TrendMetric;
  granularity: 'DAY' | 'MONTH' | 'YEAR';
  hasData: boolean;
  onSelectPeriod?: (item: TrendItem) => void;
  className?: string;
}

const CHART_HEIGHT = 140;

/**
 * 收支趋势柱状图（自绘 SVG）。
 *
 * 不引图表库：只有柱状一种形态，用 `rect` 足够；主题色直接取语义 token，
 * 深色模式跟随 `--color-financial-expense` / `--color-financial-income`。
 *
 * 结余可能为负，所以以零基线为中心双向绘制。
 */
export function TrendChart({
  items,
  metric,
  granularity,
  hasData,
  onSelectPeriod,
  className,
}: TrendChartProps): React.JSX.Element {
  const values = items.map((item) => pickValue(item, metric));
  const points = toTrendPoints(values);
  const bipolar = hasNegative(values);
  const max = Math.max(...values.map((value) => Math.abs(value)), 0);

  const barClass =
    metric === 'INCOME'
      ? 'fill-emerald-500'
      : metric === 'NET'
        ? 'fill-sky-500'
        : 'fill-rose-500';

  if (!hasData || items.length === 0) {
    return (
      <div className={cn('flex h-[140px] items-center justify-center', className)}>
        <p className="text-xs text-text-tertiary">当前范围内没有数据</p>
      </div>
    );
  }

  // 双向图：零线在中间；单向图：零线在底部
  const zeroY = bipolar ? CHART_HEIGHT / 2 : CHART_HEIGHT;
  const available = bipolar ? CHART_HEIGHT / 2 : CHART_HEIGHT;
  const barWidth = Math.max(1, Math.min(10, 100 / items.length - 1));
  const step = 100 / items.length;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between px-1 pb-1">
        <span className="text-[11px] text-text-muted">
          峰值 {formatCompactYuan(max)}
        </span>
        <span className="text-[11px] text-text-tertiary">{items.length} 个周期</span>
      </div>

      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[140px] w-full"
        role="img"
        aria-label={`趋势图，共 ${items.length} 个周期`}
      >
        {/* 零基线 */}
        <line
          x1="0"
          x2="100"
          y1={zeroY}
          y2={zeroY}
          className="stroke-app-divider"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />

        {items.map((item, index) => {
          const point = points[index];
          if (!point || point.heightPercent === 0) return null;

          const height = (point.heightPercent / 100) * available;
          const x = index * step + (step - barWidth) / 2;
          const y = values[index] < 0 ? zeroY : zeroY - height;

          return (
            <rect
              key={`${item.fromDate}-${item.toDate}`}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx={0.6}
              className={cn(barClass, 'cursor-pointer')}
              onClick={() => onSelectPeriod?.(item)}
            >
              <title>
                {formatPeriodLabel(item.fromDate, item.toDate, granularity)}：
                ¥{formatCompactYuan(values[index])}
              </title>
            </rect>
          );
        })}
      </svg>

      <div className="flex justify-between px-1 pt-1 text-[10px] text-text-tertiary">
        <span>{formatPeriodLabel(items[0].fromDate, items[0].toDate, granularity)}</span>
        {items.length > 2 && (
          <span>
            {formatPeriodLabel(
              items[Math.floor(items.length / 2)].fromDate,
              items[Math.floor(items.length / 2)].toDate,
              granularity,
            )}
          </span>
        )}
        <span>
          {formatPeriodLabel(
            items[items.length - 1].fromDate,
            items[items.length - 1].toDate,
            granularity,
          )}
        </span>
      </div>
    </div>
  );
}

function pickValue(item: TrendItem, metric: TrendMetric): number {
  if (metric === 'INCOME') return item.incomeCents;
  if (metric === 'NET') return item.netCents;
  return item.expenseCents;
}

/** 趋势图的指标切换。切换只改渲染，不重新请求（三个金额已随响应返回）。 */
export interface TrendMetricTabsProps {
  value: TrendMetric;
  onChange: (metric: TrendMetric) => void;
  granulatingLabel: string;
}

const METRICS = [
  { key: 'EXPENSE', label: '支出' },
  { key: 'INCOME', label: '收入' },
  { key: 'NET', label: '结余' },
] as const;

export function TrendMetricTabs({
  value,
  onChange,
  granulatingLabel,
}: TrendMetricTabsProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-tertiary">{granulatingLabel}</span>
      <div className="flex rounded-full bg-app-card-subtle p-0.5">
        {METRICS.map((metric) => (
          <button
            key={metric.key}
            type="button"
            onClick={() => onChange(metric.key)}
            aria-pressed={value === metric.key}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
              value === metric.key
                ? 'bg-app-card text-text-main shadow-xs'
                : 'text-text-muted',
            )}
          >
            {metric.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { StatisticsGranularity };
