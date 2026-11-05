'use client';

import * as React from 'react';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { Skeleton } from '@/components/ui/skeleton';

export interface PendingInvitation {
  id: string;
  targetEmail: string;
  role: 'EDITOR' | 'VIEWER';
  createdAt?: string;
  expiresAt: string;
  inviteLink?: string;
}

export interface InvitationListProps {
  state: 'loading' | 'error' | 'empty' | 'ready';
  invitations: readonly PendingInvitation[];
  onRevoke?: (i: PendingInvitation) => void;
  pendingInvitationId?: string | null;
  onRetry?: () => void;
  notice?: string | null;
}

export function InvitationList({
  state,
  invitations,
  onRevoke,
  pendingInvitationId,
  onRetry,
  notice,
}: InvitationListProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {/* 顶部提示条（notice 非空） */}
      {notice && (
        <div className="flex items-start gap-2.5 rounded-xl border border-app-border bg-app-card-subtle p-3 text-xs text-text-muted">
          <Info className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {/* 状态 1: loading */}
      {state === 'loading' && (
        <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
              <Skeleton className="h-8 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* 状态 2: error */}
      {state === 'error' && (
        <div className="rounded-2xl border border-app-border bg-app-card p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-rose-600 font-medium">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>获取邀请列表失败</span>
          </div>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
            >
              重试
            </Button>
          )}
        </div>
      )}

      {/* 状态 3: empty */}
      {state === 'empty' && (
        <div className="rounded-2xl border border-app-border bg-app-card p-6 text-center text-text-muted text-sm">
          暂无待处理邀请
        </div>
      )}

      {/* 状态 4: ready */}
      {state === 'ready' && (
        <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
          {invitations.map((inv) => (
            <InvitationRow
              key={inv.id}
              invitation={inv}
              onRevoke={onRevoke}
              isPending={pendingInvitationId === inv.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationRow({
  invitation,
  onRevoke,
  isPending,
}: {
  invitation: PendingInvitation;
  onRevoke?: (i: PendingInvitation) => void;
  isPending: boolean;
}): React.JSX.Element {
  // M月D日 到期
  const expiryDate = invitation.expiresAt
    ? new Date(invitation.expiresAt)
    : null;
  const expiryText = expiryDate && !isNaN(expiryDate.getTime())
    ? `${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日 到期`
    : '长期有效';

  return (
    <div className="flex items-center justify-between p-4 gap-3">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-main truncate max-w-[180px]">
            {invitation.targetEmail}
          </span>
          <LedgerBadge role={invitation.role} />
        </div>
        <div className="text-xs text-text-tertiary">
          {expiryText}
        </div>
      </div>

      {onRevoke && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => onRevoke(invitation)}
          className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 shrink-0"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            '撤销'
          )}
        </Button>
      )}
    </div>
  );
}
