'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { SecondaryLayout } from '@/components/layout/SecondaryLayout';
import { Button } from '@/components/ui/button';
import { LedgerManageList, type LedgerManageGroup } from './LedgerManageList';
import { LedgerActionSheet, type LedgerAction } from './LedgerActionSheet';
import { LedgerListSkeleton } from '@/components/skeleton/LedgerListSkeleton';
import type { LedgerSummary } from '@/lib/api/ledger-types';

export interface LedgerManageViewProps {
  state: 'loading' | 'error' | 'empty' | 'ready';
  groups: readonly LedgerManageGroup[];
  currentLedgerId: string | null;
  pendingLedgerId: string | null;
  errorMessage: string | null;
  canManage: (l: LedgerSummary) => boolean;
  onRetry: () => void;
  onCreate: () => void;
  onSelect: (l: LedgerSummary) => void;
  onOpenMenu: (l: LedgerSummary) => void;
  actionsFor: (l: LedgerSummary) => readonly LedgerAction[];
  menuLedger: LedgerSummary | null;
  onMenuOpenChange: (open: boolean) => void;
  onAction: (key: LedgerAction['key']) => void;
}

export function LedgerManageView({
  state,
  groups,
  currentLedgerId,
  pendingLedgerId,
  errorMessage,
  canManage,
  onRetry,
  onCreate,
  onSelect,
  onOpenMenu,
  actionsFor,
  menuLedger,
  onMenuOpenChange,
  onAction,
}: LedgerManageViewProps): React.JSX.Element {
  const rightAction = (
    <Button
      variant="ghost"
      size="icon"
      onClick={onCreate}
      aria-label="新建账本"
      className="size-9 rounded-full text-text-main hover:bg-app-card-subtle"
    >
      <Plus className="size-5" aria-hidden="true" />
    </Button>
  );

  return (
    <SecondaryLayout
      title="我的账本"
      fallbackBackUrl="/user"
      rightAction={rightAction}
      className="pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      <div className="py-2">
        {state === 'loading' && <LedgerListSkeleton />}

        {state === 'error' && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 max-w-xs mb-4">
              {errorMessage ?? '加载账本失败，请稍后重试'}
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              重新加载
            </Button>
          </div>
        )}

        {state === 'empty' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Plus className="size-8" />
            </div>
            <h3 className="text-base font-semibold text-text-main">还没有账本</h3>
            <p className="mt-1 text-xs text-text-tertiary max-w-xs mb-6">
              创建你的第一个记账本，开启清晰有序的财务记录
            </p>
            <Button onClick={onCreate} className="px-6">
              新建账本
            </Button>
          </div>
        )}

        {state === 'ready' && (
          <LedgerManageList
            groups={groups}
            currentLedgerId={currentLedgerId}
            pendingLedgerId={pendingLedgerId}
            canManage={canManage}
            onSelect={onSelect}
            onOpenMenu={onOpenMenu}
          />
        )}
      </div>

      {/* 账本操作抽屉 */}
      <LedgerActionSheet
        open={menuLedger !== null}
        onOpenChange={onMenuOpenChange}
        ledger={menuLedger}
        actions={menuLedger ? actionsFor(menuLedger) : []}
        onAction={onAction}
      />
    </SecondaryLayout>
  );
}
