'use client';

import * as React from 'react';
import type { LedgerMemberSummary } from '@/lib/api/member-types';
import { BottomSheet, SHEET_BODY_SCROLL } from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export interface MemberAction {
  key: 'role' | 'remove';
  label: string;
  description?: string;
  danger?: boolean;
}

export interface MemberActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: LedgerMemberSummary | null;
  actions: readonly MemberAction[];
  onAction: (key: MemberAction['key']) => void;
  onRequestTransfer?: () => void;
}

export function MemberActionSheet({
  open,
  onOpenChange,
  member,
  actions,
  onAction,
  onRequestTransfer,
}: MemberActionSheetProps): React.JSX.Element {
  const title = member
    ? (member.user.nickname ?? member.user.username)
    : '成员操作';

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      layer="nested"
    >
      <div className={cn(SHEET_BODY_SCROLL, 'space-y-4')}>
        {/* 操作列表 */}
        <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                onAction(action.key);
              }}
              className={cn(
                'w-full flex items-center justify-between p-4 text-left transition-colors',
                'hover:bg-app-card-subtle active:bg-app-card-subtle/80',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
              )}
            >
              <div className="space-y-0.5">
                <div
                  className={cn(
                    'text-sm font-medium',
                    action.danger ? 'text-rose-600' : 'text-text-main'
                  )}
                >
                  {action.label}
                </div>
                {action.description && (
                  <div className="text-xs text-text-tertiary">
                    {action.description}
                  </div>
                )}
              </div>
              <ChevronRight className="size-4 text-text-tertiary shrink-0" aria-hidden="true" />
            </button>
          ))}

          {/* 若 onRequestTransfer 提供，底部额外一条「转移账本 Owner」入口 */}
          {onRequestTransfer && (
            <button
              type="button"
              onClick={() => {
                onRequestTransfer();
              }}
              className={cn(
                'w-full flex items-center justify-between p-4 text-left transition-colors',
                'hover:bg-app-card-subtle active:bg-app-card-subtle/80',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
              )}
            >
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-text-main">
                  转移账本 Owner
                </div>
                <div className="text-xs text-text-tertiary">
                  将账本所有权移交给该成员，你将变为记账协作
                </div>
              </div>
              <ChevronRight className="size-4 text-text-tertiary shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
