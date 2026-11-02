'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 个人中心页面专属骨架屏
 * 1:1 还原大头像卡片、外观设置卡片、关于安全卡片及退出登录按钮
 */
export function UserProfileSkeleton(): React.JSX.Element {
  return (
    <div className="select-none">
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 一级页面顶部大标题骨架 */}
        <div className="pt-2 pb-1">
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        {/* 1. 个人资料卡片骨架 */}
        <div className="rounded-3xl bg-app-card p-5 shadow-xs border border-app-border">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-2xl bg-primary/20 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-full bg-primary/10" />
              </div>
              <Skeleton className="h-3.5 w-20 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
        </div>

        {/* 2. 外观与主题偏好卡片骨架 */}
        <div className="rounded-3xl bg-app-card shadow-xs border border-app-border overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border/60">
            <Skeleton className="h-3.5 w-20 rounded-md" />
          </div>
          <div className="divide-y divide-app-border/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl bg-app-card-subtle" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-3 w-32 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl bg-app-card-subtle" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-18 rounded-md" />
                  <Skeleton className="h-3 w-36 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-12 rounded-md" />
            </div>
          </div>
        </div>

        {/* 3. 关于与安全卡片骨架 */}
        <div className="rounded-3xl bg-app-card shadow-xs border border-app-border overflow-hidden">
          <div className="divide-y divide-app-border/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl bg-app-card-subtle" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-3 w-36 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-10 rounded-md" />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl bg-app-card-subtle" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-12 rounded-md" />
            </div>
          </div>
        </div>

        {/* 4. 退出登录按钮骨架 */}
        <div className="pt-2 space-y-2">
          <Skeleton className="w-full h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20" />
          <Skeleton className="h-3 w-48 mx-auto rounded-md" />
        </div>
      </div>
    </div>
  );
}

