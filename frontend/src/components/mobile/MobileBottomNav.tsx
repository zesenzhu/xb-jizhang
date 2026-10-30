'use client';

import * as React from 'react';
import { BarChart3, Home, Plus, ReceiptText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavTab = 'home' | 'transactions' | 'stats' | 'profile';

export interface MobileBottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
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
    { key: 'home' as const, label: '明细', icon: Home },
    { key: 'transactions' as const, label: '账本', icon: ReceiptText },
    { key: 'quickAdd' as const, label: '记账', icon: Plus, isAction: true },
    { key: 'stats' as const, label: '统计', icon: BarChart3 },
    { key: 'profile' as const, label: '我的', icon: User },
  ];

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-safe select-none sm:hidden',
        className,
      )}
      aria-label="移动端底部导航"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.key === 'quickAdd') {
            return (
              <div key={tab.key} className="relative -top-3 flex flex-col items-center">
                <button
                  type="button"
                  onClick={onQuickAdd}
                  className="flex size-13 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95 active:bg-emerald-700"
                  aria-label="快速记一笔"
                >
                  <Plus size={26} strokeWidth={2.5} />
                </button>
                <span className="mt-1 text-[10px] font-medium text-slate-500">{tab.label}</span>
              </div>
            );
          }

          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-1 transition-colors',
                isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span className={cn('mt-1 text-[11px]', isActive ? 'font-semibold' : 'font-normal')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

