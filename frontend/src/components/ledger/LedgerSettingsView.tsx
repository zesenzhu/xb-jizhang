'use client';

import * as React from 'react';
import { SecondaryLayout } from '@/components/layout/SecondaryLayout';
import { Button } from '@/components/ui/button';
import { LedgerSettingsList, type LedgerSettingsItem } from './LedgerSettingsList';
import { LedgerListSkeleton } from '@/components/skeleton/LedgerListSkeleton';
import type { LedgerSummary } from '@/lib/api/ledger-types';

export interface LedgerSettingsViewProps {
  state: 'loading' | 'error' | 'ready';
  ledger: LedgerSummary | null;
  memberCount: number;
  groups: readonly { title: string; items: readonly LedgerSettingsItem[] }[];
  errorMessage: string | null;
  onRetry: () => void;
  readonlyNotice: string | null;
}

export function LedgerSettingsView({
  state,
  ledger,
  memberCount,
  groups,
  errorMessage,
  onRetry,
  readonlyNotice,
}: LedgerSettingsViewProps): React.JSX.Element {
  return (
    <SecondaryLayout
      title={ledger?.name ?? '账本设置'}
      fallbackBackUrl="/user/ledgers"
      className="pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      <div className="py-2">
        {state === 'loading' && <LedgerListSkeleton />}

        {state === 'error' && (
          <div role="alert" className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 max-w-xs mb-4">
              {errorMessage ?? '加载账本详情失败，请稍后重试'}
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              重新加载
            </Button>
          </div>
        )}

        {state === 'ready' && ledger && (
          <div className="space-y-6">
            {readonlyNotice && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                {readonlyNotice}
              </div>
            )}
            <LedgerSettingsList
              ledger={ledger}
              memberCount={memberCount}
              groups={groups}
            />
          </div>
        )}
      </div>
    </SecondaryLayout>
  );
}
