'use client';

import * as React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveGridTile, type CategoryNode } from '@/lib/bill/category-tree';
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
 * 有子分类的一级分类在九宫格下方内联展开，避免再打开一层抽屉导致用户丢失记账上下文。
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
    <div>
      <div className="grid grid-cols-5 gap-y-3.5 px-4 pb-3 pt-1">
        {nodes.map((node) => {
          const tile = resolveGridTile(node, selectedId);
          const hasChildren = node.children.length > 0;
          const isExpanded = expandedId === node.id;
          const isGroupPick = tile.isRoot && !tile.selected && hasChildren;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                if (hasChildren) {
                  setExpandedId((current) => (current === node.id ? null : node.id));
                  return;
                }
                onSelect(node.id);
              }}
              aria-pressed={tile.selected}
              aria-expanded={hasChildren ? isExpanded : undefined}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 transition-transform active:scale-95"
            >
              <span className="relative">
                <CategoryIcon {...iconProps(tile.node)} size="lg" className={cn(tile.selected && 'ring-2 ring-primary ring-offset-2 ring-offset-app-card')} />
                {isGroupPick && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-app-card text-primary shadow-xs"
                    aria-hidden="true"
                  >
                    <ChevronDown size={11} className={cn(isExpanded && 'rotate-180')} />
                  </span>
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

      {expanded && (
        <div className="mx-4 mb-3 rounded-2xl border border-app-border bg-app-card-subtle/60 p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-text-muted">{expanded.name} 下的分类</span>
            <span className="text-[10px] text-text-tertiary">也可以只记到一级</span>
          </div>
          <CategoryChildList
            node={expanded}
            selectedId={selectedId}
            onPick={onSelect}
          />
        </div>
      )}
    </div>
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
    <div className="grid grid-cols-3 gap-2">
      <CategoryChildButton
        name={node.name}
        selected={node.id === selectedId}
        icon={node}
        hint="一级"
        onClick={() => onPick(node.id)}
      />
      {node.children.map((child) => (
        <CategoryChildButton
          key={child.id}
          name={child.name}
          selected={child.id === selectedId}
          icon={child}
          onClick={() => onPick(child.id)}
        />
      ))}
    </div>
  );
}

function CategoryChildButton({
  name,
  selected,
  icon,
  hint,
  onClick,
}: {
  name: string;
  selected: boolean;
  icon: CategoryNode;
  hint?: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center',
        selected ? 'border-primary/40 bg-primary/10' : 'border-transparent bg-app-card',
      )}
    >
      <CategoryIcon {...iconProps(icon)} size="sm" />
      <span className={cn('max-w-full truncate text-[11px]', selected ? 'font-semibold text-primary' : 'text-text-main')}>
        {name}
      </span>
      {hint && <span className="text-[9px] text-text-tertiary">{hint}</span>}
    </button>
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
