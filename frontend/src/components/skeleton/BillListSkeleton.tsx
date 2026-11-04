import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 账单页专属骨架：概览卡 + 三组日期卡。
 * 与真实布局 1:1 对齐，避免加载完成时的视口跳动。
 */
export function BillListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <Skeleton className="h-40 w-full rounded-3xl" />

      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-3 rounded-2xl border border-app-border bg-app-card p-4">
            {Array.from({ length: groupIndex === 0 ? 3 : 2 }).map((__, rowIndex) => (
              <div key={rowIndex} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
