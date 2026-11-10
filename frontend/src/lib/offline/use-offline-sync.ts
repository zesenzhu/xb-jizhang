'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useOfflineStore } from '@/store/offlineStore';
import { getLocalCacheStats } from './storage';
import { syncPendingOfflineTransactions } from './sync-engine';

export function useOfflineSync(): void {
  const queryClient = useQueryClient();
  const userId = useUserAuthStore((state) => state.currentUser?.id ?? null);
  const authStatus = useUserAuthStore((state) => state.status);
  const isOnline = useOfflineStore((state) => state.isOnline);
  const syncRequestedAt = useOfflineStore((state) => state.syncRequestedAt);
  const setSyncState = useOfflineStore((state) => state.setSyncState);
  const runningRef = React.useRef(false);

  const refreshStats = React.useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const stats = await getLocalCacheStats(userId);
      setSyncState({
        syncStatus: 'idle',
        pendingCount: stats.pendingTransactionCount + stats.pendingAttachmentCount,
        lastSyncAt: stats.lastSyncAt,
      });
    } catch {
      // 浏览器不支持 IndexedDB 时不阻塞在线页面，离线保存会在提交时给出明确错误。
    }
  }, [setSyncState, userId]);

  const runSync = React.useCallback(async (): Promise<void> => {
    if (!userId || authStatus !== 'authenticated' || !isOnline || runningRef.current) return;
    runningRef.current = true;
    setSyncState({ syncStatus: 'syncing', lastError: null });
    try {
      const result = await syncPendingOfflineTransactions(userId);
      const stats = await getLocalCacheStats(userId);
      const hasError = result.failedCount > 0 || result.conflictCount > 0;
      setSyncState({
        syncStatus: hasError ? (result.conflictCount > 0 ? 'conflict' : 'failed') : 'succeeded',
        pendingCount: stats.pendingTransactionCount + stats.pendingAttachmentCount,
        lastError: hasError ? '部分离线记录需要处理' : null,
        lastSyncAt: stats.lastSyncAt,
      });
      if (result.processedCount > 0) {
        await queryClient.invalidateQueries({ queryKey: ['ledger'] });
      }
    } catch (error) {
      setSyncState({
        syncStatus: 'failed',
        lastError: error instanceof Error ? error.message : '离线同步失败，请稍后重试',
      });
      await refreshStats();
    } finally {
      runningRef.current = false;
    }
  }, [authStatus, isOnline, queryClient, refreshStats, setSyncState, userId]);

  React.useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  React.useEffect(() => {
    if (!isOnline) return;
    void runSync();
  }, [isOnline, runSync, syncRequestedAt]);

  React.useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') void runSync();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [runSync]);
}
