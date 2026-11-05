'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MobileBottomNav, type NavTab } from '@/components/mobile/MobileBottomNav';
import { getUserPrimaryTab, isUserPrimaryTabRoute } from '@/lib/routing/routes';

export interface UserNavShellProps {
  children: React.ReactNode;
}

/**
 * 用户端全局导航外壳。
 *
 * 底栏常驻在布局层，一级页面互相切换时保持挂载，避免 DOM 反复卸载导致跳闪；
 * 二级页面（我的账本、账本设置、成员管理等）自动隐藏底栏，靠页面内返回。
 */
export function UserNavShell({ children }: UserNavShellProps): React.JSX.Element {
  const pathname = usePathname();

  const currentTab = pathname ? getUserPrimaryTab(pathname) : null;
  const isPrimaryTab = pathname ? isUserPrimaryTabRoute(pathname) : false;

  return (
    <div className="relative min-h-screen bg-app-bg text-text-main">
      {/* 仅一级页留出底栏避让高度；二级页无底栏，不需要这段留白。 */}
      <div className={isPrimaryTab ? 'pb-24' : ''}>{children}</div>

      {isPrimaryTab && currentTab && <MobileBottomNav activeTab={currentTab as NavTab} />}
    </div>
  );
}
