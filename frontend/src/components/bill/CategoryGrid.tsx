'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryNode } from '@/lib/bill/category-tree';

export interface CategoryGridProps {
  /** 已按类型过滤并构造成两级树的分类 */
  nodes: readonly CategoryNode[];
  selectedId: string | null;
  /** 选中分类；一级自身也可直接选中 */
  onSelect: (categoryId: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

const SKELETON_COUNT = 15;

/**
 * 记账面板正中的分类九宫格。
 *
 * 分类是记账唯一必填项，所以占据可滚动区域的主体：顶部类型切换与底部键盘固定，
 * 只有这一块滚动。有子分类的一级分类点开后在下方展开子类，不弹第二层面板。
 */
export function CategoryGrid({
  nodes,
  selectedId,
  onSelect,
  isLoading = false,
  errorMessage = null,
  onRetry,
}: CategoryGridProps): React.JSX.Element {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const expanded = expandedId ? nodes.find((node) => node.id === expandedId) : undefined;

  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-y-3.5 px-4 pb-3 pt-1" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-1.5">
            <span className="size-11 animate-pulse rounded-full bg-app-card-subtle" />
            <span className="h-2.5 w-8 animate-pulse rounded bg-app-card-subtle" />
          </div>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-text-muted">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-app-border px-4 py-1.5 text-xs font-semibold text-text-main"
          >
            重新加载
          </button>
        )}
      </div>
    );
  }

  if (nodes.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-text-muted">当前账本还没有可用的分类。</p>;
  }

  return (
    <div className="pb-2">
      <div className="grid grid-cols-5 gap-y-3.5 px-4 pb-3 pt-1">
        {nodes.map((node) => {
          const selected = node.id === selectedId;
          const hasChildren = node.children.length > 0;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                if (hasChildren) {
                  setExpandedId((value) => (value === node.id ? null : node.id));
                  return;
                }
                onSelect(node.id);
              }}
              aria-pressed={selected}
              aria-expanded={hasChildren ? expandedId === node.id : undefined}
              className="flex flex-col items-center gap-1.5 rounded-xl py-1 transition-transform active:scale-95"
            >
              <CategoryBubble name={node.name} color={node.color} selected={selected} hasChildren={hasChildren} />
              <span
                className={cn(
                  'max-w-full truncate text-[11px] leading-none',
                  selected ? 'font-semibold text-primary' : 'text-text-muted',
                )}
              >
                {node.name}
              </span>
            </button>
          );
        })}
      </div>

      {expanded && (
        <div className="mx-4 mb-2 overflow-hidden rounded-2xl border border-app-border">
          <p className="flex items-center gap-1.5 bg-app-card-subtle px-3 py-2 text-[11px] font-semibold text-text-muted">
            {expanded.name}
            <ChevronRight size={12} />
            选择子分类，或直接记到「{expanded.name}」
          </p>
          <div className="divide-y divide-app-divider">
            <CategoryRow
              label={expanded.name}
              hint="记到一级"
              color={expanded.color}
              selected={expanded.id === selectedId}
              onClick={() => onSelect(expanded.id)}
            />
            {expanded.children.map((child) => (
              <CategoryRow
                key={child.id}
                label={child.name}
                color={child.color}
                selected={child.id === selectedId}
                onClick={() => onSelect(child.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBubble({
  name,
  color,
  selected,
  hasChildren,
}: {
  name: string;
  color: string | null;
  selected: boolean;
  hasChildren: boolean;
}): React.JSX.Element {
  return (
    <span className="relative">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-11 items-center justify-center rounded-full text-base font-semibold text-white shadow-xs',
          selected && 'ring-2 ring-primary ring-offset-2 ring-offset-app-card',
        )}
        style={{ backgroundColor: color ?? paletteFor(name) }}
      >
        {name.trim().slice(0, 1) || '账'}
      </span>
      {hasChildren && (
        <span
          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-app-card"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function CategoryRow({
  label,
  hint,
  color,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  color: string | null;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-primary/8' : 'bg-app-card active:bg-app-card-subtle',
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: color ?? paletteFor(label) }}
      >
        {label.trim().slice(0, 1) || '账'}
      </span>
      <span className={cn('flex-1 text-xs', selected ? 'font-semibold text-primary' : 'text-text-main')}>
        {label}
      </span>
      {hint && <span className="text-[10px] text-text-tertiary">{hint}</span>}
      {selected && <span className="text-[11px] font-semibold text-primary">已选</span>}
    </button>
  );
}

/** 与 CategoryIcon 同一色板：同一分类在全站颜色一致。 */
const PALETTE = ['#ff6b5b', '#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#9b8cf5', '#eb7ab8', '#8d9db6'];

function paletteFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
