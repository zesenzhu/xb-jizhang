'use client';

import * as React from 'react';
import { AlertCircle, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SyncStatusBarProps {
  /** 是否在线 */
  isOnline: boolean;
  /** 离线队列中待同步笔数 */
  pendingCount?: number;
  /** 是否正在执行后台同步 */
  isSyncing?: boolean;
  /** 是否有同步冲突或错误 */
  hasConflict?: boolean;
  /** 点击手动重试同步回调 */
  onRetry?: () => void;
  className?: string;
}

export function SyncStatusBar({
  isOnline,
  pendingCount = 0,
  isSyncing = false,
  hasConflict = false,
  onRetry,
  className,
}: SyncStatusBarProps): React.JSX.Element | null {
  if (isOnline && pendingCount === 0 && !isSyncing && !hasConflict) {
    return null;
  }

  // 1. 同步冲突或失败
  if (hasConflict) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs text-rose-800 border border-rose-200/60 shadow-xs animate-in fade-in',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" aria-hidden="true" />
          <span>离线账单同步遇到冲突或失败</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-900 active:scale-95"
          >
            <RefreshCw size={12} />
            重试
          </button>
        )}
      </div>
    );
  }

  // 2. 正在同步中
  if (isSyncing) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-2xl bg-blue-50 px-4 py-2.5 text-xs text-ios-blue border border-blue-200/60 shadow-xs animate-in fade-in',
          className,
        )}
      >
        <Loader2 size={16} className="animate-spin text-ios-blue shrink-0" aria-hidden="true" />
        <span>正在同步 {pendingCount > 0 ? `${pendingCount} 笔` : ''} 离线账单至云端...</span>
      </div>
    );
  }

  // 3. 离线模式
  if (!isOnline) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800 border border-amber-200/60 shadow-xs animate-in fade-in',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <CloudOff size={16} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span>
            已进入离线模式
            {pendingCount > 0 ? ` · ${pendingCount} 笔账单暂存本地` : ' · 暂存账单在联网后自动同步'}
          </span>
        </div>
      </div>
    );
  }

  // 4. 在线但有待同步队列
  if (pendingCount > 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-2xl bg-blue-50 px-4 py-2.5 text-xs text-ios-blue border border-blue-200/60 shadow-xs animate-in fade-in',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-ios-blue shrink-0" aria-hidden="true" />
          <span>发现 {pendingCount} 笔本地未同步记录</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-ios-blue underline underline-offset-2 hover:opacity-80"
          >
            立即同步
          </button>
        )}
      </div>
    );
  }

  return null;
}
