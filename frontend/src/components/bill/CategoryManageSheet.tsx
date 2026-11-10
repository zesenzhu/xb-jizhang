'use client';

import * as React from 'react';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategorySummary } from '@/lib/api/category-types';
import { countActiveChildren, sortCategories } from '@/lib/bill/category-manage';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryManageSheetProps {
  /** 当前类型下的全部分类（含停用，由调用方按 includeInactive 拉取） */
  categories: readonly CategorySummary[];
  isLoading: boolean;
  showInactive: boolean;
  onToggleInactive: () => void;
  onEdit: (category: CategorySummary) => void;
  onCreate: () => void;
}

/**
 * 分类管理列表：按一级分类分组展示子分类。
 *
 * 只负责展示与派发编辑事件；增删改逻辑在 `CategoryEditorSheet`，
 * 两者拆开才能让「管理」与「编辑」各自保持单一职责。
 */
export function CategoryManageBody({
  categories,
  isLoading,
  showInactive,
  onToggleInactive,
  onEdit,
  onCreate,
}: CategoryManageSheetProps): React.JSX.Element {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(new Set());

  const roots = React.useMemo(
    () => sortCategories(categories.filter((item) => item.parentId === null)),
    [categories],
  );

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-3" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-xl bg-app-card-subtle" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleInactive}
          aria-pressed={showInactive}
          className={cn(
            'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
            showInactive
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-app-border text-text-muted',
          )}
        >
          {showInactive ? '隐藏已停用' : '显示已停用'}
        </button>
        <span className="text-[11px] text-text-tertiary">共 {roots.length} 个一级分类</span>
      </div>

      {roots.length === 0 && (
        <p className="py-8 text-center text-sm text-text-muted">还没有分类。</p>
      )}

      <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border">
        {roots.map((root) => {
          const children = sortCategories(
            categories.filter((item) => item.parentId === root.id),
          );
          const isCollapsed = collapsed.has(root.id);
          const activeChildren = countActiveChildren(categories, root.id);

          return (
            <div key={root.id} className={cn(!root.isActive && 'opacity-60')}>
              <div className="flex items-center gap-2 bg-app-card px-3 py-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((previous) => {
                      const next = new Set(previous);
                      if (next.has(root.id)) next.delete(root.id);
                      else next.add(root.id);
                      return next;
                    })
                  }
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `展开 ${root.name}` : `收起 ${root.name}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <ChevronDown
                    size={14}
                    className={cn(
                      'shrink-0 text-text-tertiary transition-transform',
                      isCollapsed && '-rotate-90',
                    )}
                  />
                  <CategoryIcon
                    name={root.name}
                    icon={root.icon}
                    iconSource={root.iconSource}
                    iconKey={root.iconKey}
                    iconAssetId={root.iconAssetId}
                    iconUrl={root.iconUrl}
                    iconUrlExpiresAt={root.iconUrlExpiresAt}
                    color={root.color}
                    size="sm"
                  />
                  <span className="truncate text-xs font-semibold text-text-main">{root.name}</span>
                  {children.length > 0 && (
                    <span className="shrink-0 text-[11px] text-text-tertiary">
                      {activeChildren}/{children.length}
                    </span>
                  )}
                  {!root.isActive && (
                    <span className="shrink-0 rounded-full bg-app-card-subtle px-1.5 py-0.5 text-[10px] text-text-tertiary">
                      已停用
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(root)}
                  className="shrink-0 rounded-full border border-app-border px-2.5 py-1 text-[11px] text-text-muted active:scale-95"
                >
                  编辑
                </button>
              </div>

              {!isCollapsed &&
                children.map((child) => (
                  <div
                    key={child.id}
                    className={cn(
                      'flex items-center gap-2 border-t border-app-divider bg-app-card-subtle/40 px-3 py-2',
                      !child.isActive && 'opacity-60',
                    )}
                  >
                    <CategoryIcon
                      name={child.name}
                      icon={child.icon}
                      iconSource={child.iconSource}
                      iconKey={child.iconKey}
                      iconAssetId={child.iconAssetId}
                      iconUrl={child.iconUrl}
                      iconUrlExpiresAt={child.iconUrlExpiresAt}
                      color={child.color}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                      {child.name}
                    </span>
                    {!child.isActive && (
                      <span className="shrink-0 rounded-full bg-app-card px-1.5 py-0.5 text-[10px] text-text-tertiary">
                        已停用
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(child)}
                      className="shrink-0 rounded-full border border-app-border px-2.5 py-1 text-[11px] text-text-muted active:scale-95"
                    >
                      编辑
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-app-border py-2.5 text-xs font-semibold text-text-muted active:scale-[0.99]"
      >
        <Plus size={14} />
        新增分类
      </button>
    </div>
  );
}

export interface CategoryManageFooterProps {
  saving: boolean;
  onClose: () => void;
}

export function CategoryManageFooter({ saving, onClose }: CategoryManageFooterProps): React.JSX.Element {
  return (
    <div className="shrink-0 border-t border-app-divider px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-app-border py-2.5 text-sm text-text-main disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        完成
      </button>
    </div>
  );
}
