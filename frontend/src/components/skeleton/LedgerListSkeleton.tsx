'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 账本管理页面分组骨架屏
 * 分为「个人账本」与「共享账本」两组，每组 2 张卡片，1:1 还原 LedgerCard 高度感
 */
export function LedgerListSkeleton(): React.JSX.Element {
  return (
    <div className="select-none space-y-6">
      {/* 个人账本组 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-3.5 w-8 rounded-md" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={`personal-${idx}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-card p-4 shadow-xs"
            >
              <div className="flex flex-1 items-center gap-3.5 min-w-0">
                <Skeleton className="size-11 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    {idx === 0 && (
                      <Skeleton className="h-4 w-12 rounded-full bg-primary/20" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              </div>
              <Skeleton className="size-8 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* 共享账本组 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-3.5 w-8 rounded-md" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={`shared-${idx}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-card p-4 shadow-xs"
            >
              <div className="flex flex-1 items-center gap-3.5 min-w-0">
                <Skeleton className="size-11 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32 rounded-md" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-3.5 w-12 rounded-md" />
                  </div>
                </div>
              </div>
              <Skeleton className="size-8 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
