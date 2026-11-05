'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, NotebookTabs, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserPrimaryTab } from '@/lib/routing/routes';

export type NavTab = UserPrimaryTab;

interface NavigationItem {
  key: NavTab;
  label: string;
  icon: typeof NotebookTabs;
  route: string;
}

/**
 * 二级页面（我的账本、账本设置、成员管理等）隐藏底栏；
 * 这里只渲染三项，记账入口在账本页 FAB，底栏不再有中央按钮。
 */
const TABS: readonly NavigationItem[] = [
  { key: 'ledger', label: '账本', icon: NotebookTabs, route: '/user' },
  { key: 'statistics', label: '统计', icon: BarChart3, route: '/user/statistics' },
  { key: 'profile', label: '我的', icon: User, route: '/user/profile' },
];

export interface MobileBottomNavProps {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  className?: string;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  className,
}: MobileBottomNavProps): React.JSX.Element {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-card/95 pb-safe backdrop-blur-md select-none transition-all sm:hidden',
        className,
      )}
      aria-label="底部主导航"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <Link
              key={tab.key}
              href={tab.route}
              prefetch={tab.key !== 'statistics'}
              onClick={() => onTabChange?.(tab.key)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-1 transition-colors',
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-main',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span
                className={cn(
                  'mt-1 text-[11px]',
                  isActive ? 'font-semibold text-primary' : 'font-normal',
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
