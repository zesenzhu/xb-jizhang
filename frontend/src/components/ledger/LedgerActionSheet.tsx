'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { BottomSheet, SHEET_BODY_SCROLL } from '@/components/ui/bottom-sheet';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { cn } from '@/lib/utils';

export interface LedgerAction {
  key: 'settings' | 'copy' | 'delete';
  label: string;
  description?: string;
  danger?: boolean;
}

export interface LedgerActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledger: LedgerSummary | null;
  actions: readonly LedgerAction[];
  onAction: (key: LedgerAction['key']) => void;
}

export function LedgerActionSheet({
  open,
  onOpenChange,
  ledger,
  actions,
  onAction,
}: LedgerActionSheetProps): React.JSX.Element {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={ledger?.name ?? '账本操作'}
    >
      <div className={cn(SHEET_BODY_SCROLL, 'space-y-1')}>
        {actions.map((act) => (
          <button
            key={act.key}
            type="button"
            onClick={() => {
              onAction(act.key);
            }}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-app-card-subtle active:bg-app-card-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              act.danger ? 'text-rose-600' : 'text-text-main',
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{act.label}</div>
              {act.description && (
                <div className="mt-0.5 text-xs text-text-tertiary">
                  {act.description}
                </div>
              )}
            </div>
            <ChevronRight className="size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
