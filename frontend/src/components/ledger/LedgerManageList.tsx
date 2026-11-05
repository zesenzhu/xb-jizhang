'use client';

import * as React from 'react';
import { LedgerCard } from './LedgerCard';
import type { LedgerSummary, LedgerType } from '@/lib/api/ledger-types';

export interface LedgerManageGroup {
  type: LedgerType;
  title: string;
  items: LedgerSummary[];
}

export interface LedgerManageListProps {
  groups: readonly LedgerManageGroup[];
  currentLedgerId: string | null;
  pendingLedgerId: string | null;
  canManage: (l: LedgerSummary) => boolean;
  onSelect: (l: LedgerSummary) => void;
  onOpenMenu: (l: LedgerSummary) => void;
}

export function LedgerManageList({
  groups,
  currentLedgerId,
  pendingLedgerId,
  canManage,
  onSelect,
  onOpenMenu,
}: LedgerManageListProps): React.JSX.Element | null {
  const visibleGroups = groups.filter((g) => g.items.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <section key={group.type} className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold tracking-wider text-text-tertiary uppercase">
              {group.title}
            </h2>
            <span className="text-xs text-text-tertiary font-mono">
              {group.items.length}
            </span>
          </div>

          <div className="grid gap-2.5">
            {group.items.map((ledger) => {
              const isCurrent = currentLedgerId === ledger.id;
              const isPending = pendingLedgerId === ledger.id;
              const showMenu = canManage(ledger);

              // 附带 isCurrent 标记以便 LedgerCard 消费
              const ledgerWithCurrent = {
                ...ledger,
                isCurrent,
              };

              return (
                <LedgerCard
                  key={ledger.id}
                  ledger={ledgerWithCurrent}
                  isPending={isPending}
                  showMenu={showMenu}
                  onSelect={onSelect}
                  onOpenMenu={onOpenMenu}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
