'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LedgerMemberSummary } from '@/lib/api/member-types';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export interface PayerPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: readonly LedgerMemberSummary[];
  selectedId: string | null;
  onSelect: (payerId: string | null) => void;
}

/** 选择实际付款人；付款人使用成员 userId，而不是 ledgerMember 记录 ID。 */
export function PayerPickerSheet({
  open,
  onOpenChange,
  members,
  selectedId,
  onSelect,
}: PayerPickerSheetProps): React.JSX.Element {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} layer="nested" title="选择付款人">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onOpenChange(false);
          }}
          className={cn(
            'mb-2 flex w-full items-center justify-between rounded-2xl border border-dashed border-app-border px-4 py-3 text-left text-sm',
            selectedId === null ? 'border-primary text-primary' : 'text-text-muted',
          )}
        >
          <span>未指定付款人</span>
          <span className="text-[11px] text-text-tertiary">只记录账单</span>
        </button>

        {members.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">暂无可选的账本成员。</p>
        )}

        <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border">
          {members.map((member) => {
            const name = member.user.nickname?.trim() || member.user.username;
            return (
              <button
                key={member.userId}
                type="button"
                onClick={() => {
                  onSelect(member.userId);
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors active:bg-app-card-subtle/60"
              >
                <span
                  className={cn(
                    'text-sm',
                    member.userId === selectedId
                      ? 'font-semibold text-primary'
                      : 'text-text-main',
                  )}
                >
                  {name}
                </span>
                {member.userId === selectedId && (
                  <span className="text-[11px] text-primary">已选</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
