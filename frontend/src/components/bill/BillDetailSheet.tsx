'use client';

import * as React from 'react';
import { AlertTriangle, Loader2, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { BillDetailFields } from './BillDetailFields';
import { CategoryIcon } from './CategoryIcon';
import type { BillDetailView } from '@/lib/bill/bill-detail';

export interface BillDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  errorMessage: string | null;
  view: BillDetailView | null;
  /** 版本冲突提示；存在时优先展示冲突条 */
  conflict: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReload: () => void;
  onRetry: () => void;
}

/**
 * 账单详情面板（只读态）。
 *
 * 编辑态由 `BillDetailSheet` 的调用方切换到记账表单，避免这个组件同时承担
 * 「展示」和「编辑」两种职责。
 */
export function BillDetailSheet({
  open,
  onOpenChange,
  isLoading,
  errorMessage,
  view,
  conflict,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onReload,
  onRetry,
}: BillDetailSheetProps): React.JSX.Element {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="账单详情">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
        {isLoading && (
          <div className="space-y-3" aria-busy="true">
            <div className="mx-auto h-8 w-32 animate-pulse rounded-lg bg-app-card-subtle" />
            <div className="mx-auto h-3 w-20 animate-pulse rounded bg-app-card-subtle" />
            <div className="h-28 animate-pulse rounded-2xl bg-app-card-subtle" />
            <div className="h-24 animate-pulse rounded-2xl bg-app-card-subtle" />
          </div>
        )}

        {!isLoading && conflict && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold">账单已更新</p>
              <p className="mt-0.5 text-amber-700">
                其他成员刚刚修改了这条账单，请查看最新内容后重新编辑。
              </p>
              <button
                type="button"
                onClick={onReload}
                className="mt-1.5 font-semibold text-amber-800 underline underline-offset-2"
              >
                查看最新内容
              </button>
            </div>
          </div>
        )}

        {!isLoading && !conflict && errorMessage && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-full border border-rose-300 px-3 py-1 font-semibold text-rose-700"
            >
              重新加载
            </button>
          </div>
        )}

        {!isLoading && !errorMessage && view && (
          <>
            <div className="mb-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    view.isExpense
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-emerald-50 text-emerald-600',
                  )}
                >
                  {view.isExpense ? '支出' : '收入'}
                </span>
              </div>
              <p
                className={cn(
                  'mt-1.5 font-mono text-[30px] font-bold leading-tight tabular-nums',
                  view.isExpense ? 'text-rose-500' : 'text-emerald-600',
                )}
              >
                {view.signedAmount}
              </p>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <CategoryIcon name={view.categoryName} size="sm" />
                {view.categoryName}
              </p>
            </div>

            <BillDetailFields view={view} />
          </>
        )}
      </div>

      {!isLoading && !errorMessage && view && (
        <div className="shrink-0 border-t border-app-divider px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center gap-2">
            {canDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-600 active:scale-[0.98]"
              >
                <Trash2 size={15} />
                删除
              </button>
            ) : (
              <span className="flex-1" />
            )}

            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
              >
                <Pencil size={15} />
                编辑
              </button>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

/** 删除确认：展示金额、类型、日期，避免误删。 */
export interface BillDeleteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountText: string;
  typeLabel: string;
  dateText: string;
  submitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
}

export function BillDeleteConfirm({
  open,
  onOpenChange,
  amountText,
  typeLabel,
  dateText,
  submitting,
  errorMessage,
  onConfirm,
}: BillDeleteConfirmProps): React.JSX.Element {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} layer="nested" title="删除这笔账单？">
      <div className="space-y-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <div className="rounded-2xl bg-app-card-subtle px-3 py-2.5">
          <p className="font-mono text-base font-semibold text-text-main">{amountText}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {typeLabel} · {dateText}
          </p>
        </div>
        <p className="text-xs text-text-tertiary">删除后无法恢复，账本余额会同步还原。</p>

        {errorMessage && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-2xl border border-app-border py-2.5 text-sm text-text-main disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            删除
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
