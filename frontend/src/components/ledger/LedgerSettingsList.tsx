'use client';

import * as React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { cn } from '@/lib/utils';

export interface LedgerSettingsItem {
  key: string;
  label: string;
  value?: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
  disabledReason?: string;
}

export interface LedgerSettingsListProps {
  ledger: LedgerSummary;
  memberCount: number;
  groups: readonly { title: string; items: readonly LedgerSettingsItem[] }[];
}

export function currencyLabel(code: string): string {
  const map: Record<string, string> = {
    CNY: '人民币 CNY',
    USD: '美元 USD',
    EUR: '欧元 EUR',
    JPY: '日元 JPY',
    HKD: '港币 HKD',
  };
  return map[code] ?? code;
}

function roleLabel(role: LedgerSummary['memberRole']): string {
  switch (role) {
    case 'OWNER':
      return '所有者';
    case 'EDITOR':
      return '记账协作';
    case 'VIEWER':
      return '只读观察';
    default:
      return role;
  }
}

export function LedgerSettingsList({
  ledger,
  groups,
}: LedgerSettingsListProps): React.JSX.Element {
  const typeText = ledger.type === 'PERSONAL' ? '个人账本' : '共享账本';
  const currText = currencyLabel(ledger.defaultCurrency);
  const roleText = roleLabel(ledger.memberRole);

  return (
    <div className="space-y-6">
      {/* 顶部资料区 */}
      <section className="flex flex-col items-center justify-center pt-2 pb-4 text-center">
        <div className="relative flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary font-medium text-xl shadow-xs">
          {ledger.icon ? (
            <span>{ledger.icon}</span>
          ) : (
            <BookOpen className="size-8 text-primary" aria-hidden="true" />
          )}
        </div>
        <h1 className="mt-3 text-lg font-bold text-text-main">
          {ledger.name}
        </h1>
        <p className="mt-1 text-xs text-text-tertiary">
          {`${typeText} · ${currText} · ${roleText}`}
        </p>
      </section>

      {/* 分组设置项 */}
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="px-3 text-xs font-medium text-text-tertiary">
              {group.title}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-app-border bg-app-card divide-y divide-app-divider">
              {group.items.map((item) => {
                const isDisabled = Boolean(item.disabledReason);
                const isClickable = typeof item.onClick === 'function' && !isDisabled;

                const content = (
                  <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          item.danger ? 'text-rose-600' : 'text-text-main',
                          isDisabled && 'text-text-muted',
                        )}
                      >
                        {item.label}
                      </div>
                      {item.description && (
                        <div className="mt-0.5 text-xs text-text-tertiary">
                          {item.description}
                        </div>
                      )}
                      {item.disabledReason && (
                        <div className="mt-1 text-xs text-text-muted">
                          {item.disabledReason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.value && (
                        <span className="text-xs text-text-muted">
                          {item.value}
                        </span>
                      )}
                      {/* 只有在可点击且存在 onClick 时渲染 ›；只读或 disabledReason 均不渲染 */}
                      {isClickable && (
                        <ChevronRight
                          className="size-4 text-text-tertiary"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                );

                if (isClickable) {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className="flex w-full items-center p-3.5 text-left transition-colors hover:bg-app-card-subtle active:bg-app-card-subtle/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-center p-3.5',
                      isDisabled && 'bg-app-card-subtle/40',
                    )}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
