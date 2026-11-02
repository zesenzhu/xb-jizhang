'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MobileBottomNav, type NavTab } from '@/components/mobile/MobileBottomNav';
import { getUserPrimaryTab, isUserPrimaryTabRoute } from '@/lib/routing/routes';

export interface UserNavShellProps {
  children: React.ReactNode;
}

/**
 * 用户端全局导航外壳
 * - 在根布局层级管理移动端底部 TabBar，实现跨页面切页时的【真正常驻】，避免 DOM 反复挂载/卸载导致的跳闪
 * - 自动检测一级 Tab 与二级子页面：二级子页面自动隐藏底栏
 */
export function UserNavShell({ children }: UserNavShellProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  const currentTab = pathname ? getUserPrimaryTab(pathname) : null;
  const isPrimaryTab = pathname ? isUserPrimaryTabRoute(pathname) : false;

  const handleQuickAdd = (): void => {
    const normalized = pathname?.replace(/\/$/, '') || '';
    if (normalized === '/user') {
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else {
      router.push('/user');
    }
  };

  return (
    <div className="relative min-h-screen bg-app-bg text-text-main">
      {/* 
        主内容容器：
        - 仅在一级 Tab 页面底部留出 6rem（pb-24）避让空间，防止内容被常驻底栏遮挡
        - 二级页面无需底栏避让
      */}
      <div className={isPrimaryTab ? 'pb-24' : ''}>{children}</div>

      {/* 
        常驻底部导航栏：
        - 驻留在顶级 Layout 树中，一级页面切换（如 明细 <-> 账本 <-> 我的）时保持挂载，绝不重新渲染或跳动
      */}
      {isPrimaryTab && currentTab && (
        <MobileBottomNav
          activeTab={currentTab as NavTab}
          onQuickAdd={handleQuickAdd}
        />
      )}
    </div>
  );
}
