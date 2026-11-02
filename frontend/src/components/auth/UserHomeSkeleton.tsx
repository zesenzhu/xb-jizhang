'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 首页（明细/记账工作台）专属骨架屏
 * 1:1 还原当前活跃账本大卡片 + 操作按钮 + 触控记账键盘
 */
export function UserHomeSkeleton(): React.JSX.Element {
  return (
    <div className="select-none">
      {/* 离线状态条占位 */}
      <div className="px-4 pt-3 max-w-md mx-auto">
        <Skeleton className="h-4 w-32 rounded-full opacity-0" />
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 当前账本主卡片骨架（顶格作为首屏骨架） */}
        <div className="rounded-3xl bg-[#16181d] p-5 shadow-xs border border-white/10 space-y-4 animate-pulse">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-xl bg-white/15" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16 rounded-md bg-white/15" />
                <Skeleton className="h-6 w-32 rounded-md bg-white/20" />
              </div>
            </div>
            <Skeleton className="h-6 w-18 rounded-full bg-white/15" />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14 rounded-md bg-white/15" />
              <Skeleton className="h-7 w-24 rounded-md bg-white/25" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14 rounded-md bg-white/15" />
              <Skeleton className="h-7 w-24 rounded-md bg-emerald-500/25" />
            </div>
          </div>
        </div>

        {/* 两个管理按钮骨架 */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Skeleton className="h-11 rounded-2xl bg-app-card-subtle" />
          <Skeleton className="h-11 rounded-2xl bg-primary/20" />
        </div>

        {/* 快捷记账键盘模块骨架 */}
        <div className="rounded-3xl bg-app-card p-5 shadow-xs border border-app-border space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <Skeleton className="h-16 w-full rounded-2xl bg-app-card-subtle" />
          <div className="grid grid-cols-4 gap-2 pt-1">
            {Array.from({ length: 12 }).map((_, idx) => (
              <Skeleton key={idx} className="h-14 rounded-2xl bg-app-card-subtle" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
