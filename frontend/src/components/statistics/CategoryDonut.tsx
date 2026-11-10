'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { CategoryBucketType, CategoryChartItem, CategoryItem } from '@/lib/api/statistics-types';
import {
  aggregateCategoryChartItems,
  formatPercentage,
  toDonutSegments,
} from '@/lib/statistics/chart';
import { CategoryIcon } from '@/components/bill/CategoryIcon';

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
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const chartItems = React.useMemo(() => aggregateCategoryChartItems(items, 8), [items]);
  const segments = toDonutSegments(chartItems.map((item) => item.percentage));

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
    <div className={cn('flex flex-col items-center', className)} onKeyDown={(event) => {
      if (event.key === 'Escape') setSelectedIndex(null);
    }}>
      <div className="relative size-44">
        <svg
          viewBox="0 0 100 100"
          className="size-44 -rotate-90"
          role="img"
          aria-label={`分类占比，共 ${chartItems.length} 项`}
        >
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            className="stroke-app-card-subtle"
            strokeWidth="14"
          />
          {segments.map((segment, index) => {
            const item = chartItems[index];
            if (!item) return null;
            const selected = selectedIndex === index;
            return (
              <circle
                key={item.categoryId ?? `bucket-${item.bucketType}-${item.name}`}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={colorFor(item, index, isExpense)}
                strokeWidth={selected ? 17 : 14}
                strokeDasharray={`${segment.ratio * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={-segment.offset * CIRCUMFERENCE}
                className="cursor-pointer transition-[stroke-width] focus:outline-none"
                tabIndex={0}
                role="button"
                aria-label={`${item.name}，${formatPercentage(item.percentage)}，${item.transactionCount} 笔`}
                onClick={() => {
                  setSelectedIndex(index);
                  if (item.bucketType !== 'OTHER') onSelect?.(item as CategoryItem);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedIndex(index);
                    if (item.bucketType !== 'OTHER') onSelect?.(item as CategoryItem);
                  }
                }}
              >
                <title>
                  {item.name} {formatPercentage(item.percentage)}，¥{formatCentsToYuan(item.amountCents)}
                </title>
              </circle>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[11px] text-text-tertiary">{isExpense ? '总支出' : '总收入'}</span>
          <span className="font-mono text-lg font-bold text-text-main">
            ¥{formatCentsToYuan(totalCents)}
          </span>
        </div>
      </div>

      {selectedIndex !== null && chartItems[selectedIndex] && (
        <CategoryTooltip item={chartItems[selectedIndex]} isExpense={isExpense} />
      )}
    </div>
  );
}

function CategoryTooltip({ item, isExpense }: { item: CategoryChartItem; isExpense: boolean }): React.JSX.Element {
  return (
    <div role="tooltip" className="mt-2 flex w-full max-w-[260px] items-center gap-2 rounded-xl bg-app-card-subtle px-3 py-2">
      <CategoryIcon
        name={item.name}
        icon={item.icon}
        iconSource={item.iconSource}
        iconKey={item.iconKey}
        iconAssetId={item.iconAssetId}
        iconUrl={item.iconUrl}
        iconUrlExpiresAt={item.iconUrlExpiresAt}
        color={item.color}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-semibold text-text-main">{item.name}</span>
          <span className="font-mono text-xs font-semibold text-text-main">¥{formatCentsToYuan(item.amountCents)}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-text-tertiary">
          {formatPercentage(item.percentage)} · {item.transactionCount} 笔 · {isExpense ? '支出' : '收入'}
        </div>
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

function colorFor(
  item: Pick<CategoryItem, 'color'> & { bucketType: CategoryBucketType | 'OTHER' },
  index: number,
  isExpense: boolean,
): string {
  if (item.color) return item.color;
  if (item.bucketType === 'UNCATEGORIZED' || item.bucketType === 'OTHER') return '#94a3b8';
  if (item.bucketType === 'ROOT_DIRECT') return isExpense ? '#fbbf24' : '#34d399';
  return PALETTE[index % PALETTE.length];
}

export interface CategoryRowProps {
  item: CategoryItem;
  isExpense: boolean;
  onClick?: () => void;
  onOpenBills?: () => void;
  drillable?: boolean;
}
/** 分类列表行：图标 + 名称 + 占比条 + 金额 + 笔数。 */
export function CategoryRow({
  item,
  isExpense,
  onClick,
  onOpenBills,
  drillable: _drillable,
}: CategoryRowProps): React.JSX.Element {
  const accent = colorFor(item, 0, isExpense);
  const delta = item.comparison?.amountDeltaCents ?? 0;

  return (
    <div className="flex items-center px-3 py-2.5 transition-colors hover:bg-app-card-subtle/60 active:bg-app-card-subtle/80">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <CategoryIcon
          name={item.name}
          icon={item.icon}
          iconSource={item.iconSource}
          iconKey={item.iconKey}
          iconAssetId={item.iconAssetId}
          iconUrl={item.iconUrl}
          iconUrlExpiresAt={item.iconUrlExpiresAt}
          color={item.color ?? accent}
          size="sm"
        />

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

      {onOpenBills && (
        <button
          type="button"
          aria-label="查看该分类账单"
          onClick={(event) => {
            event.stopPropagation();
            onOpenBills();
          }}
          className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-app-card-subtle hover:text-text-main active:scale-95"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
