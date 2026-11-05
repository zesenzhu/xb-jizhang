'use client';

import * as React from 'react';
import { BottomSheet, SHEET_BODY_SCROLL, SHEET_FOOTER } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DeleteLedgerConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerName: string;
  isDeleting: boolean;
  error: string | null;
  blockers: readonly string[];
  onConfirm: () => void;
}

export function DeleteLedgerConfirm({
  open,
  onOpenChange,
  ledgerName,
  isDeleting,
  error,
  blockers,
  onConfirm,
}: DeleteLedgerConfirmProps): React.JSX.Element {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="删除账本"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={SHEET_BODY_SCROLL}>
          <div className="space-y-5">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm text-text-main leading-relaxed">
                确定要永久删除账本 <span className="font-semibold text-text-main">{ledgerName}</span> 吗？
                <span className="block mt-1 font-medium text-rose-600">删除后所有数据将永久消失，无法恢复。</span>
              </p>

              {blockers.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5">
                  <div className="text-xs font-medium text-amber-900">暂不可删除的原因：</div>
                  <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                    {blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={cn(SHEET_FOOTER, 'flex gap-3')}>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            isLoading={isDeleting}
            disabled={blockers.length > 0}
            onClick={onConfirm}
          >
            {blockers.length > 0 ? '暂不可删除' : '永久删除'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
