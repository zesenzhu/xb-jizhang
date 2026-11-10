'use client';

import * as React from 'react';
import { Database, Image as ImageIcon, ReceiptText, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useOfflineStore } from '@/store/offlineStore';
import {
  clearAllLocalData,
  clearImageCache,
  clearSyncedSnapshots,
  getLocalCacheStats,
} from '@/lib/offline/storage';
import type { LocalCacheStats } from '@/lib/offline/storage-types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CacheManagementPanel(): React.JSX.Element {
  const userId = useUserAuthStore((state) => state.currentUser?.id ?? null);
  const setSyncState = useOfflineStore((state) => state.setSyncState);
  const [stats, setStats] = React.useState<LocalCacheStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [action, setAction] = React.useState<'images' | 'snapshots' | 'all' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadStats = React.useCallback(async (): Promise<void> => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setStats(await getLocalCacheStats(userId));
      setError(null);
    } catch {
      setError('本地缓存暂时不可用，请检查浏览器存储权限');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadStats(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStats]);

  const runAction = async (kind: 'images' | 'snapshots' | 'all'): Promise<void> => {
    if (!userId) return;
    if (kind === 'all' && !window.confirm('清理全部本地数据会删除未同步账单和待上传图片，确定继续吗？')) return;
    setAction(kind);
    setError(null);
    try {
      if (kind === 'images') await clearImageCache(userId);
      if (kind === 'snapshots') await clearSyncedSnapshots(userId);
      if (kind === 'all') await clearAllLocalData(userId);
      const next = await getLocalCacheStats(userId);
      setStats(next);
      setSyncState({
        syncStatus: 'idle',
        pendingCount: next.pendingTransactionCount + next.pendingAttachmentCount,
        lastSyncAt: next.lastSyncAt,
      });
    } catch {
      setError('清理失败，请稍后重试');
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="space-y-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
      <div className="rounded-2xl border border-app-border bg-app-card-subtle p-3 text-xs text-text-muted">
        <div className="flex items-start gap-2">
          <Database className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>本地数据只保存在当前设备。清理已同步数据不会影响云端账单。</p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border bg-app-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ImageIcon className="size-4 text-text-muted" aria-hidden="true" />
            <span className="text-sm text-text-main">图片缓存</span>
          </div>
          <span className="text-xs text-text-muted">
            {loading ? '读取中' : `${formatBytes(stats?.imageBytes ?? 0)} / 100 MB`}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ReceiptText className="size-4 text-text-muted" aria-hidden="true" />
            <span className="text-sm text-text-main">账单快照</span>
          </div>
          <span className="text-xs text-text-muted">
            {loading ? '读取中' : `${stats?.transactionSnapshotCount ?? 0} 条`}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-main">待同步数据</span>
          <span className="text-xs text-amber-700">
            {loading ? '读取中' : `${(stats?.pendingTransactionCount ?? 0) + (stats?.pendingAttachmentCount ?? 0)} 项`}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-main">最近同步</span>
          <span className="text-right text-xs text-text-muted">
            {stats?.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString('zh-CN') : '暂无记录'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          isLoading={action === 'images'}
          disabled={loading || action !== null || (stats?.imageCount ?? 0) === 0}
          onClick={() => void runAction('images')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          清理图片缓存
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          isLoading={action === 'snapshots'}
          disabled={loading || action !== null || (stats?.transactionSnapshotCount ?? 0) === 0}
          onClick={() => void runAction('snapshots')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          清理已同步账单快照
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="w-full justify-start"
          isLoading={action === 'all'}
          disabled={loading || action !== null}
          onClick={() => void runAction('all')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          清理全部本地数据
        </Button>
      </div>

      <button
        type="button"
        className="mx-auto flex items-center gap-1 text-xs text-primary"
        onClick={() => void loadStats()}
      >
        <RefreshCw className="size-3" aria-hidden="true" />
        刷新本地占用
      </button>
    </div>
  );
}
