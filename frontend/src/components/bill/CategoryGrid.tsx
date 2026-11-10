'use client';

import * as React from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  categorySelectionSheetTitle,
  resolveCategorySelection,
  resolveGridTile,
  type CategoryNode,
} from '@/lib/bill/category-tree';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { CategoryIcon } from './CategoryIcon';

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
 * 有子分类的一级分类点击后打开独立的二级分类弹窗，保留记账抽屉的原交互。
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
          const tile = resolveGridTile(node, selectedId);
          const hasChildren = node.children.length > 0;
          const isGroupPick = tile.isRoot && !tile.selected && hasChildren;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                const selection = resolveCategorySelection(node);
                if (selection.kind === 'OPEN_CHILDREN') {
                  setExpandedId(selection.node.id);
                  return;
                }
                onSelect(selection.categoryId);
              }}
              aria-pressed={tile.selected}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 transition-transform active:scale-95"
            >
              <span className="relative">
                <CategoryIcon {...iconProps(tile.node)} size="lg" className={cn(tile.selected && 'ring-2 ring-primary ring-offset-2 ring-offset-app-card')} />
                {isGroupPick && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-app-card"
                    aria-hidden="true"
                  />
                )}
              </span>
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
            className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 transition-transform active:scale-95"
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-app-border text-text-tertiary">
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
        title={expanded ? categorySelectionSheetTitle(expanded, selectedId) : ''}
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
        <CategoryIcon {...iconProps(node)} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text-main">{node.name}</span>
          <span className="mt-0.5 block text-[11px] text-text-tertiary">只记到一级分类</span>
        </span>
        {node.id === selectedId && <span className="shrink-0 text-[11px] font-semibold text-primary">已选</span>}
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
              <CategoryIcon {...iconProps(child)} size="sm" />
              <span className={cn('min-w-0 flex-1 truncate text-xs', selected ? 'font-semibold text-primary' : 'text-text-main')}>
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

function iconProps(category: CategoryNode) {
  return {
    name: category.name,
    icon: category.icon,
    iconSource: category.iconSource,
    iconKey: category.iconKey,
    iconAssetId: category.iconAssetId,
    iconUrl: category.iconUrl,
    iconUrlExpiresAt: category.iconUrlExpiresAt,
    color: category.color,
  };
}
