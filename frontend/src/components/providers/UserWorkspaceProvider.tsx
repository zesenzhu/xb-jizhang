'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLedgers } from '@/lib/api/ledger-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { resolveInitialLedgerId } from '@/lib/ledger/ledger-form';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useOnlineStatusSync } from '@/lib/offline/use-online-status';
import { useOfflineSync } from '@/lib/offline/use-offline-sync';

export function UserWorkspaceProvider({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const authStatus = useUserAuthStore((state) => state.status);
  // 离线性是全应用级事实，挂在这里保证所有用户页共享同一份状态。
  useOnlineStatusSync();
  useOfflineSync();
  const queryClient = useQueryClient();
  const ledgersQuery = useQuery({
    queryKey: queryKeys.ledgers.list(),
    queryFn: () => getLedgers(),
    staleTime: queryStaleTime.ledgers,
    enabled: authStatus === 'authenticated',
  });

  React.useEffect(() => {
    if (authStatus === 'unauthenticated') {
      queryClient.removeQueries({
        predicate: (query) => {
          const rootKey = query.queryKey[0];
          return rootKey === 'user' || rootKey === 'ledgers' || rootKey === 'ledger';
        },
      });
      return;
    }
    if (ledgersQuery.data === undefined) return;
    const initialLedgerId = resolveInitialLedgerId(ledgersQuery.data.items, currentLedgerId);
    if (initialLedgerId === currentLedgerId) return;
    void Promise.resolve().then(() => setCurrentLedgerId(initialLedgerId));
  }, [authStatus, currentLedgerId, ledgersQuery.data, queryClient, setCurrentLedgerId]);

  return <>{children}</>;
}
