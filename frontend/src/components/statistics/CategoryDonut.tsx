'use client';

import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { CategoryItem } from '@/lib/api/statistics-types';
import { formatPercentage, toDonutSegments } from '@/lib/statistics/chart';

export interface CategoryDonutProps {
  items: readonly CategoryItem[];
  totalCents: number;
  isExpense: boolean;
  onSelect?: (item: CategoryItem) => void;
  className?: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * 分类占比环形图（自绘 SVG）。
 *
 * 用 `stroke-dasharray` 画扇区：设 dasharray 为 `弧长 剩余长度`，
 * dashoffset 为该扇区在圆周上的起点，就能拼出完整环。
 * 中心留白显示总额，与需求 9.5 一致。
 */
export function CategoryDonut({
  items,
  totalCents,
  isExpense,
  onSelect,
  className,
}: CategoryDonutProps): React.JSX.Element {
  const segments = toDonutSegments(items.map((item) => item.percentage));

  if (items.length === 0 || totalCents === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-2 py-6', className)}>
        <div className="flex size-36 items-center justify-center rounded-full border-[14px] border-app-card-subtle">
          <span className="text-xs text-text-tertiary">暂无数据</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg
        viewBox="0 0 100 100"
        className="size-44 -rotate-90"
        role="img"
        aria-label={`分类占比，共 ${items.length} 项`}
      >
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          className="stroke-app-card-subtle"
          strokeWidth="14"
        />
        {segments.map((segment, index) => (
          <circle
            key={items[index].categoryId ?? `bucket-${index}`}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={colorFor(items[index], index, isExpense)}
            strokeWidth="14"
            strokeDasharray={`${segment.ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={-segment.offset * CIRCUMFERENCE}
            className="cursor-pointer transition-[stroke-width] hover:stroke-[16]"
            onClick={() => onSelect?.(items[index])}
          >
            <title>
              {items[index].name} {formatPercentage(items[index].percentage)}
            </title>
          </circle>
        ))}
      </svg>

      {/* 中心总额：绝对定位盖在环中间，避免 SVG 内文字被 rotate 影响 */}
      <div className="pointer-events-none -mt-[7.4rem] flex size-44 flex-col items-center justify-center gap-0.5">
        <span className="text-[11px] text-text-tertiary">{isExpense ? '总支出' : '总收入'}</span>
        <span className="font-mono text-lg font-bold text-text-main">
          ¥{formatCentsToYuan(totalCents)}
        </span>
      </div>
    </div>
  );
}

/**
 * 扇区配色。
 *
 * 优先用后端返回的 `color`；缺失时按固定色板轮转，
 * 保证同一份数据每次渲染颜色一致（不随排序变化）。
 */
const PALETTE = ['#ff6b5b', '#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#9b8cf5', '#eb7ab8', '#8d9db6'];

function colorFor(item: CategoryItem, index: number, isExpense: boolean): string {
  if (item.color) return item.color;
  if (item.bucketType === 'UNCATEGORIZED') return '#94a3b8';
  if (item.bucketType === 'ROOT_DIRECT') return isExpense ? '#fbbf24' : '#34d399';
  return PALETTE[index % PALETTE.length];
}

export interface CategoryRowProps {
  item: CategoryItem;
  isExpense: boolean;
  onClick?: () => void;
}

/** 分类列表行：图标 + 名称 + 占比条 + 金额 + 笔数。 */
export function CategoryRow({ item, isExpense, onClick }: CategoryRowProps): React.JSX.Element {
  const accent = colorFor(item, 0, isExpense);
  const delta = item.comparison?.amountDeltaCents ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-app-card-subtle/60"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: accent }}
      >
        {item.name.trim().slice(0, 1) || '账'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-medium text-text-main">{item.name}</span>
          <span className="shrink-0 font-mono text-xs font-semibold text-text-main">
            ¥{formatCentsToYuan(item.amountCents)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-app-card-subtle">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, item.percentage)}%`, backgroundColor: accent }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-text-tertiary">
            {formatPercentage(item.percentage)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-tertiary">
          <span>{item.transactionCount} 笔</span>
          {item.comparison && (
            <span
              className={cn(
                'tabular-nums',
                delta > 0 ? 'text-rose-500' : delta < 0 ? 'text-emerald-600' : 'text-text-tertiary',
              )}
            >
              环比 {delta >= 0 ? '+' : ''}
              {formatCentsToYuan(delta)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
