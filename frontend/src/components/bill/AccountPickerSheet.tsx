'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { AccountSummary } from '@/lib/api/account-types';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export interface AccountPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: readonly AccountSummary[];
  selectedId: string | null;
  onSelect: (accountId: string | null) => void;
}

export function AccountPickerSheet({
  open,
  onOpenChange,
  accounts,
  selectedId,
  onSelect,
}: AccountPickerSheetProps): React.JSX.Element {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} layer="nested" title="选择账户">
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
          <span>不关联账户</span>
          <span className="text-[11px] text-text-tertiary">不影响余额</span>
        </button>

        {accounts.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">这个账本还没有账户。</p>
        )}

        <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onSelect(account.id);
                onOpenChange(false);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors active:bg-app-card-subtle/60"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm',
                    account.id === selectedId ? 'font-semibold text-primary' : 'text-text-main',
                  )}
                >
                  {account.name}
                </span>
                {account.visibility === 'PRIVATE' && (
                  <span className="rounded-full bg-app-card-subtle px-1.5 py-0.5 text-[10px] text-text-tertiary">
                    私人
                  </span>
                )}
              </span>
              <span className="font-mono text-xs text-text-muted">
                ¥{(account.currentBalanceCents / 100).toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
