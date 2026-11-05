'use client';

import * as React from 'react';
import type { LedgerMemberSummary } from '@/lib/api/member-types';
import { BottomSheet, SHEET_BODY_SCROLL, SHEET_FOOTER } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, User } from 'lucide-react';

export interface TransferOwnerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: readonly LedgerMemberSummary[];
  isSubmitting: boolean;
  error: string | null;
  onConfirm: (m: LedgerMemberSummary) => void;
}

export function TransferOwnerSheet({
  open,
  onOpenChange,
  candidates,
  isSubmitting,
  error,
  onConfirm,
}: TransferOwnerSheetProps): React.JSX.Element {
  const [selectedMember, setSelectedMember] = React.useState<LedgerMemberSummary | null>(null);

  const [wasOpen, setWasOpen] = React.useState(open);

  // 每次打开都清空上次选择；渲染期比较，避免 effect 里同步 setState 引起的级联渲染。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setSelectedMember(null);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="转移账本 Owner"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={SHEET_BODY_SCROLL}>
        <div className="text-sm text-text-muted leading-relaxed">
          转移后你将变为记账协作（EDITOR），账本始终保留一名 Owner。请选择一位成员移交所有权。
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 flex items-center gap-2" role="alert">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 候选列表 */}
        <div className="mt-4 divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
          {candidates.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelectedMember(member)}
              aria-pressed={selectedMember?.id === member.id}
              className={cn(
                'w-full flex items-center p-4 transition-colors',
                selectedMember?.id === member.id
                  ? 'bg-primary-subtle'
                  : 'hover:bg-app-card-subtle'
              )}
            >
              <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 shrink-0">
                <User className="size-4 text-slate-500" />
              </div>
              <span className="text-sm font-medium text-text-main">
                {member.user.nickname ?? member.user.username}
              </span>
            </button>
          ))}
        </div>
        </div>

        {/* 确认转移 */}
        <div className={cn(SHEET_FOOTER, 'flex gap-3')}>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            disabled={!selectedMember || isSubmitting}
            isLoading={isSubmitting}
            onClick={() => selectedMember && onConfirm(selectedMember)}
          >
            确认转移
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
