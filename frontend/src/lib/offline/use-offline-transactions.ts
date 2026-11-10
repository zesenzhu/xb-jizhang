'use client';

import * as React from 'react';
import { useOfflineStore } from '@/store/offlineStore';
import { listOfflineTransactions } from './storage';
import { toLocalTransactionSummary } from './local-transaction';
import type { TransactionSummary } from '@/lib/api/transaction-types';

export function useOfflineTransactions(
  userId: string | null,
  ledgerId: string | null,
): TransactionSummary[] {
  const stateVersion = useOfflineStore((state) => state.stateVersion);
  const cacheKey = `${userId ?? 'anonymous'}:${ledgerId ?? 'none'}`;
  const [snapshot, setSnapshot] = React.useState<{
    cacheKey: string;
    transactions: TransactionSummary[];
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!userId || !ledgerId) return () => undefined;
    void listOfflineTransactions(userId, ledgerId)
      .then((records) => {
        if (!active) return;
        setSnapshot({
          cacheKey,
          transactions: records
            .filter((record) => record.status !== 'SYNCED')
            .map(toLocalTransactionSummary),
        });
      })
      .catch(() => {
        if (active) setSnapshot({ cacheKey, transactions: [] });
      });
    return () => {
      active = false;
    };
  }, [cacheKey, ledgerId, stateVersion, userId]);

  return snapshot?.cacheKey === cacheKey ? snapshot.transactions : [];
}
