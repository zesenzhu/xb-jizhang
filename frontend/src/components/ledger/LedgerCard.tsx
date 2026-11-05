'use client';

import * as React from 'react';
import { BookOpen, Check, Loader2, MoreHorizontal } from 'lucide-react';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { cn } from '@/lib/utils';

export interface LedgerCardProps {
  ledger: LedgerSummary;
  isPending: boolean;
  showMenu: boolean;
  onSelect: (l: LedgerSummary) => void;
  onOpenMenu: (l: LedgerSummary) => void;
}

export function LedgerCard({
  ledger,
  isPending,
  showMenu,
  onSelect,
  onOpenMenu,
}: LedgerCardProps): React.JSX.Element {
  const isCurrent = Boolean((ledger as { isCurrent?: boolean }).isCurrent);
  const memberCount = (ledger as { memberCount?: number }).memberCount ?? (ledger.type === 'SHARED' ? 1 : undefined);
  const isShared = ledger.type === 'SHARED';

  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-3 rounded-2xl border bg-app-card p-3.5 shadow-xs transition-colors',
        isCurrent
          ? 'border-primary/60 ring-1 ring-primary/20'
          : 'border-app-border hover:border-primary/30',
      )}
    >
      {/* 主体可点击按钮 */}
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSelect(ledger)}
        className="flex flex-1 items-center gap-3.5 text-left min-w-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        {/* 账本图标 */}
        <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-medium text-base overflow-hidden">
          {isPending ? (
            <Loader2 className="size-5 animate-spin text-primary" aria-label="处理中" />
          ) : ledger.icon ? (
            <span>{ledger.icon}</span>
          ) : (
            <BookOpen className="size-5 text-primary" aria-hidden="true" />
          )}
        </div>

        {/* 账本信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-text-main">
              {ledger.name}
            </span>
            {isCurrent && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                <Check className="size-3" aria-hidden="true" />
                <span>当前</span>
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <LedgerBadge type={ledger.type} />
            {isShared && ledger.memberRole && (
              <LedgerBadge role={ledger.memberRole} />
            )}
            {isShared && typeof memberCount === 'number' && (
              <span className="text-text-tertiary">
                {memberCount} 位成员
              </span>
            )}
          </div>
        </div>
      </button>

      {/* 右侧操作按钮：与卡片主体是两个独立平级按钮，禁止嵌套 */}
      {showMenu && (
        <button
          type="button"
          onClick={() => onOpenMenu(ledger)}
          aria-label="账本操作"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-app-card-subtle hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
