'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export interface SecondaryPageSkeletonProps {
  title?: string;
  subtitle?: string;
}

/**
 * 二级页面专属骨架屏（如新建账本、账本设置、账单详情等）
 * 包含吸顶 SecondaryHeader 骨架与主卡片表单骨架
 */
export function SecondaryPageSkeleton({
  title = '页面加载中',
  subtitle = '用户工作区',
}: SecondaryPageSkeletonProps): React.JSX.Element {
  return (
    <div className="select-none">
      {/* 吸顶二级导航头骨架 */}
      <div className="sticky top-0 z-30 border-b border-app-border bg-app-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="rounded-3xl border border-app-border bg-app-card p-6 shadow-xs space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-3.5 w-56 rounded-md" />
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-16 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-16 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Skeleton className="h-9 w-16 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl bg-primary/20" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

