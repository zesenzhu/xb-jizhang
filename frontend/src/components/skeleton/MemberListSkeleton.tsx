'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function MemberListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4" role="status" aria-label="正在加载成员列表">
      {/* 吸顶头/列表头骨架 */}
      <div className="flex items-center justify-between px-1 py-2">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>

      {/* 4 行成员骨架 */}
      <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 rounded-md" />
              </div>
            </div>
            <Skeleton className="size-8 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
