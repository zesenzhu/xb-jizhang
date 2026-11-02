'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, Home, Plus, ReceiptText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavTab = 'home' | 'transactions' | 'stats' | 'profile';

export interface MobileBottomNavProps {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  onQuickAdd: () => void;
  className?: string;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onQuickAdd,
  className,
}: MobileBottomNavProps): React.JSX.Element {
  const tabs = [
    { key: 'home' as const, label: '明细', icon: Home, route: '/user' },
    { key: 'transactions' as const, label: '账本', icon: ReceiptText, route: '/user/ledger' },
    { key: 'quickAdd' as const, label: '记账', icon: Plus, isAction: true },
    { key: 'stats' as const, label: '统计', icon: BarChart3, route: '/user' },
    { key: 'profile' as const, label: '我的', icon: User, route: '/user/profile' },
  ];

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-40 border-t border-app-border bg-app-card/95 backdrop-blur-md pb-safe select-none sm:hidden transition-all',
        className,
      )}
      aria-label="移动端底部导航"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <div key={tab.key} className="relative -top-3 flex flex-col items-center">
                <button
                  type="button"
                  onClick={onQuickAdd}
                  className="flex size-13 items-center justify-center rounded-full bg-accent-fab text-slate-950 shadow-lg shadow-accent-fab/30 transition-all active:scale-95 hover:opacity-90 cursor-pointer"
                  aria-label="快速记一笔"
                >
                  <Plus size={26} strokeWidth={2.6} />
                </button>
                <span className="mt-1 text-[10px] font-semibold text-text-muted">{tab.label}</span>
              </div>
            );
          }

          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.route}
              prefetch={true}
              onClick={() => {
                if (onTabChange) {
                  onTabChange(tab.key as NavTab);
                }
              }}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-1 transition-colors',
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-main',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className={cn('mt-1 text-[11px]', isActive ? 'font-semibold text-primary' : 'font-normal')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
