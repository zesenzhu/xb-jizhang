'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LedgerMemberRole } from '@/lib/api/ledger-types';

export interface CreateBillFabProps {
  memberRole: LedgerMemberRole | undefined;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}

/** 只有 OWNER 与 EDITOR 可以记账；VIEWER 不渲染入口。 */
export function CreateBillFab({
  memberRole,
  onClick,
  disabled = false,
  disabledHint,
}: CreateBillFabProps): React.JSX.Element | null {
  if (memberRole !== 'OWNER' && memberRole !== 'EDITOR') return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledHint : '记一笔'}
      aria-label={disabled ? (disabledHint ?? '记一笔') : '记一笔'}
      className={cn(
        'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95',
        'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
        disabled
          ? 'bg-app-card-subtle text-text-tertiary shadow-none'
          : 'bg-accent-fab text-slate-950 shadow-accent-fab/30',
      )}
    >
      <Plus size={26} strokeWidth={2.6} />
    </button>
  );
}
