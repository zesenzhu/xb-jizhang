'use client';

import * as React from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveGridTile, type CategoryNode } from '@/lib/bill/category-tree';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export interface CategoryGridProps {
  /** 已按类型过滤并构造成两级树的分类 */
  nodes: readonly CategoryNode[];
  selectedId: string | null;
  /** 选中分类；一级自身也可直接选中 */
  onSelect: (categoryId: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** 有分类管理权限（OWNER）时才渲染「＋」 */
  canManage?: boolean;
  onCreate?: () => void;
}

const SKELETON_COUNT = 15;

/**
 * 记账面板正中的分类九宫格。
 *
 * 有子分类的一级分类在图标右下角显示角标，点击打开**独立的二级抽屉**，
 * 而不是在九宫格下方就地展开 —— 就地展开会把下面的字段区推走，
 * 视觉上像一张被截断的长列表，且和底部金额卡挤在一起。
 */
export function CategoryGrid({
  nodes,
  selectedId,
  onSelect,
  isLoading = false,
  errorMessage = null,
  onRetry,
  canManage = false,
  onCreate,
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
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-sm text-text-muted">当前账本还没有可用的分类。</p>
        {canManage && onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white active:scale-95"
          >
            <Plus size={14} strokeWidth={2.8} />
            新增分类
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-y-3.5 px-4 pb-3 pt-1">
        {nodes.map((node) => {
          // 选中二级时，这一格显示二级本身（一级与二级都是「分类项」），
          // 否则选完子分类后九宫格毫无变化，用户不知道有没有选中。
          const tile = resolveGridTile(node, selectedId);
          const hasChildren = node.children.length > 0;
          const isGroupPick = tile.isRoot && !tile.selected && hasChildren;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                if (hasChildren) {
                  setExpandedId(node.id);
                  return;
                }
                onSelect(node.id);
              }}
              aria-pressed={tile.selected}
              className="flex flex-col items-center gap-1.5 rounded-xl py-1 transition-transform active:scale-95"
            >
              <CategoryBubble
                name={tile.node.name}
                color={tile.node.color}
                selected={tile.selected}
                hasChildren={isGroupPick}
              />
              <span
                className={cn(
                  'max-w-full truncate text-[11px] leading-none',
                  tile.selected ? 'font-semibold text-primary' : 'text-text-muted',
                )}
              >
                {tile.node.name}
              </span>
            </button>
          );
        })}

        {canManage && onCreate && (
          <button
            type="button"
            onClick={onCreate}
            aria-label="新增分类"
            className="flex flex-col items-center gap-1.5 rounded-xl py-1 transition-transform active:scale-95"
          >
            <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-app-border text-text-tertiary">
              <Plus size={18} />
            </span>
            <span className="max-w-full truncate text-[11px] leading-none text-text-tertiary">新增</span>
          </button>
        )}
      </div>

      <BottomSheet
        open={expanded !== undefined}
        onOpenChange={(next) => {
          if (!next) setExpandedId(null);
        }}
        layer="nested"
        title={expanded ? sheetTitle(expanded, selectedId) : ''}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
          {expanded && (
            <CategoryChildList
              node={expanded}
              selectedId={selectedId}
              onPick={(categoryId) => {
                onSelect(categoryId);
                setExpandedId(null);
              }}
            />
          )}
        </div>
      </BottomSheet>
    </>
  );
}

/** 二级抽屉标题：已选子分类时显示「一级 › 二级」，让用户确认当前选中的是哪一层。 */
function sheetTitle(node: CategoryNode, selectedId: string | null): string {
  const selectedChild = node.children.find((child) => child.id === selectedId);
  return selectedChild ? `${node.name} · ${selectedChild.name}` : node.name;
}

/**
 * 二级分类列表。
 *
 * 一级自身始终在首行且可选（需求 7.5：直接选一级不自动猜测二级），
 * 子分类按后端 `sortOrder` 顺序排列。
 */
function CategoryChildList({
  node,
  selectedId,
  onPick,
}: {
  node: CategoryNode;
  selectedId: string | null;
  onPick: (categoryId: string) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onPick(node.id)}
        aria-pressed={node.id === selectedId}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
          node.id === selectedId
            ? 'border-primary/40 bg-primary/10'
            : 'border-app-border bg-app-card active:bg-app-card-subtle',
        )}
      >
        <CategoryBubble name={node.name} color={node.color} selected={false} hasChildren={false} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text-main">{node.name}</span>
          <span className="mt-0.5 block text-[11px] text-text-tertiary">只记到一级分类</span>
        </span>
        {node.id === selectedId && (
          <span className="shrink-0 text-[11px] font-semibold text-primary">已选</span>
        )}
      </button>

      <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border">
        {node.children.map((child) => {
          const selected = child.id === selectedId;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onPick(child.id)}
              aria-pressed={selected}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                selected ? 'bg-primary/8' : 'bg-app-card active:bg-app-card-subtle',
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: child.color ?? paletteFor(child.name) }}
              >
                {child.name.trim().slice(0, 1) || '账'}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-xs',
                  selected ? 'font-semibold text-primary' : 'text-text-main',
                )}
              >
                {child.name}
              </span>
              {selected && <span className="shrink-0 text-[11px] font-semibold text-primary">已选</span>}
            </button>
          );
        })}
      </div>

      <p className="flex items-center justify-center gap-1 pt-1 text-[11px] text-text-tertiary">
        <ChevronLeft size={12} />
        返回上一级可换其他分类
      </p>
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

/** 与 CategoryIcon 同一色板：同一分类在全站颜色一致。 */
const PALETTE = ['#ff6b5b', '#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#9b8cf5', '#eb7ab8', '#8d9db6'];

function paletteFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
