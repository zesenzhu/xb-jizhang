'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApiRequestError } from '@/lib/api/errors';
import { createCategory, updateCategory } from '@/lib/api/category-api';
import type { CategorySummary, CategoryType } from '@/lib/api/category-types';
import { queryKeys } from '@/lib/query/query-config';
import {
  CATEGORY_NAME_MAX_LENGTH,
  canDeactivateCategory,
  countActiveChildren,
  nextSortOrder,
  parentOptions,
  validateCategoryName,
} from '@/lib/bill/category-manage';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export interface CategoryEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: string;
  /** 新建时使用的类型；编辑时以分类自身类型为准 */
  type: CategoryType;
  /** 全部启用的同级分类，用于父级候选与排序默认值 */
  categories: readonly CategorySummary[];
  /** 一级分类候选项，来自当前类型的分类树 */
  parentNodes: readonly { id: string; name: string }[];
  /** 传 null 表示新建 */
  editing: CategorySummary | null;
  onSaved?: (category: CategorySummary) => void;
}

/**
 * 分类新建 / 编辑面板。
 *
 * 「删除」在这个表单里是**停用**：后端不提供物理删除（历史账单要保留分类关联）。
 * 文案一律用「停用」，避免用户以为能找回被删的数据。
 */
export function CategoryEditorSheet({
  open,
  onOpenChange,
  ledgerId,
  type,
  categories,
  parentNodes,
  editing,
  onSaved,
}: CategoryEditorSheetProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState('0');
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [wasOpen, setWasOpen] = React.useState(open);

  // 打开时按 editing 预填，关闭后不清理（下次打开会再次覆盖），避免闪旧值。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(editing?.name ?? '');
      setParentId(editing?.parentId ?? null);
      setSortOrder(
        String(editing?.sortOrder ?? nextSortOrder(categories, type, null)),
      );
      setIsActive(editing?.isActive ?? true);
      setError(null);
    }
  }

  const activeChildren = editing ? countActiveChildren(categories, editing.id) : 0;
  const deactivateCheck = canDeactivateCategory(activeChildren);
  const options = React.useMemo(
    () => parentOptions(parentNodes, editing?.id ?? null),
    [parentNodes, editing?.id],
  );

  const nameCheck = validateCategoryName(name);
  const canSubmit = nameCheck.error === null;

  const mutation = useMutation({
    mutationFn: async () => {
      const sortValue = Number(sortOrder);
      if (!Number.isInteger(sortValue) || sortValue < 0) {
        throw new ApiRequestError(
          { success: false, code: 40000, message: '排序必须是非负整数', data: null },
          400,
        );
      }
      if (editing) {
        return updateCategory(ledgerId, editing.id, {
          name: nameCheck.name,
          parentId,
          sortOrder: sortValue,
          isActive,
        });
      }
      return createCategory(ledgerId, {
        type,
        name: nameCheck.name,
        parentId,
        sortOrder: sortValue,
      });
    },
  });

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setError(null);
    try {
      const saved = await mutation.mutateAsync();
      // 记账面板与统计页读同一个前缀键，必须整体失效。
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories(ledgerId) });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError(
          caught.code === 40921
            ? '同级已有同名分类'
            : caught.code === 40321
              ? '只有账本所有者可以管理分类'
              : caught.message,
        );
        return;
      }
      setError('保存失败，请检查网络后重试');
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      layer="nested"
      title={editing ? '编辑分类' : '新增分类'}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-3">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-text-tertiary">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              placeholder="如 餐饮、早餐"
              aria-label="分类名称"
              autoFocus
              className={cn(
                'w-full rounded-xl border bg-app-card-subtle/70 px-3 py-2 text-sm text-text-main placeholder:text-text-tertiary focus:outline-none',
                nameCheck.error && name.length > 0 ? 'border-rose-300' : 'border-app-border',
              )}
            />
            {name.length > 0 && nameCheck.error && (
              <span className="mt-1 block text-[11px] text-rose-500">{nameCheck.error}</span>
            )}
          </label>

          <fieldset>
            <legend className="mb-1 block text-[11px] font-semibold text-text-tertiary">归类</legend>
            <div className="overflow-hidden rounded-xl border border-app-border">
              <button
                type="button"
                onClick={() => setParentId(null)}
                aria-pressed={parentId === null}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs',
                  parentId === null ? 'bg-primary/10 text-primary' : 'bg-app-card text-text-main',
                )}
              >
                <RadioDot checked={parentId === null} />
                一级分类
              </button>
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setParentId(option.id)}
                  aria-pressed={parentId === option.id}
                  className={cn(
                    'flex w-full items-center gap-2 border-t border-app-divider px-3 py-2 text-left text-xs',
                    parentId === option.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-app-card text-text-main',
                  )}
                >
                  <RadioDot checked={parentId === option.id} />
                  归到「{option.name}」
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-text-tertiary">
              排序（小的在前）
            </span>
            <input
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              aria-label="排序"
              className="w-full rounded-xl border border-app-border bg-app-card-subtle/70 px-3 py-2 text-sm text-text-main focus:outline-none"
            />
          </label>

          {editing && (
            <div className="rounded-xl border border-app-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-main">
                    {isActive ? '停用分类' : '重新启用'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {isActive
                      ? '停用后不能再用于新账单，历史账单仍保留'
                      : '启用后重新出现在记账面板'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive((value) => !value)}
                  disabled={isActive && !deactivateCheck.ok}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40',
                    isActive
                      ? 'border border-rose-200 text-rose-600'
                      : 'bg-primary text-white',
                  )}
                >
                  {isActive ? '停用' : '启用'}
                </button>
              </div>
              {isActive && !deactivateCheck.ok && (
                <p className="mt-1.5 text-[11px] text-rose-500">{deactivateCheck.reason}</p>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-app-divider px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            className="rounded-2xl border border-app-border py-2.5 text-sm text-text-main disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit || mutation.isPending}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function RadioDot({ checked }: { checked: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-primary' : 'border-app-border',
      )}
    >
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}
