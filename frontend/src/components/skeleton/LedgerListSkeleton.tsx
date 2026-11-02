'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 账本管理页面专属骨架屏
 * 1:1 还原“我的账本”标题、新建按钮及多条账本卡片列表
 */
export function LedgerListSkeleton(): React.JSX.Element {
  return (
    <div className="select-none">
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* 一级页面顶部大标题与新建按钮骨架 */}
        <header className="flex items-center justify-between pt-2 pb-1">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-3.5 w-44 rounded-md" />
          </div>
          <Skeleton className="h-9 w-24 rounded-2xl bg-primary/20" />
        </header>

        {/* 账本条目卡片骨架列表 */}
        <div className="grid gap-3 pt-1">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 rounded-2xl border border-app-border bg-app-card p-4 shadow-xs"
            >
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  {idx === 0 && (
                    <Skeleton className="h-4 w-14 rounded-full bg-primary/20" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-14 rounded-full bg-app-card-subtle" />
                  <Skeleton className="h-4 w-12 rounded-full bg-app-card-subtle" />
                  <Skeleton className="h-3.5 w-8 rounded-md" />
                </div>
              </div>
              <Skeleton className="size-4 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

