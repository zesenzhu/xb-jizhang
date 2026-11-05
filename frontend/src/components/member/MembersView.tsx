'use client';

import * as React from 'react';
import type { LedgerMemberSummary } from '@/lib/api/member-types';
import { SecondaryLayout } from '@/components/layout/SecondaryLayout';
import { MemberList } from '@/components/member/MemberList';
import { InvitationList, type PendingInvitation } from '@/components/member/InvitationList';
import { MemberListSkeleton } from '@/components/skeleton/MemberListSkeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, ChevronRight, Plus, Shield } from 'lucide-react';

export interface MembersViewProps {
  state: 'loading' | 'error' | 'ready';
  ledgerName: string | null;
  memberCount: number;
  members: readonly LedgerMemberSummary[];
  currentUserId: string | null;
  canManage: boolean;
  pendingMemberId: string | null;
  onRetry: () => void;
  onOpenMemberActions: (m: LedgerMemberSummary) => void;
  canInvite: boolean;
  onInvite: () => void;
  invitationState: 'unavailable' | 'loading' | 'error' | 'empty' | 'ready';
  invitations: readonly PendingInvitation[];
  pendingInvitationId?: string | null;
  onRevokeInvitation?: (i: PendingInvitation) => void;
  onRetryInvitations?: () => void;
  invitationNotice?: string | null;
  canTransfer: boolean;
  onTransfer: () => void;
}

export function MembersView({
  state,
  ledgerName,
  memberCount,
  members,
  currentUserId,
  canManage,
  pendingMemberId,
  onRetry,
  onOpenMemberActions,
  canInvite,
  onInvite,
  invitationState,
  invitations,
  pendingInvitationId,
  onRevokeInvitation,
  onRetryInvitations,
  invitationNotice,
  canTransfer,
  onTransfer,
}: MembersViewProps): React.JSX.Element {
  return (
    <SecondaryLayout
      title="成员与邀请"
      fallbackBackUrl="/user/ledgers"
      rightAction={
        canInvite ? (
          <Button
            type="button"
            size="sm"
            onClick={onInvite}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>邀请成员</span>
          </Button>
        ) : undefined
      }
    >
      <div className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* 头部摘要 */}
        <div className="flex items-baseline justify-between px-1">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-text-main truncate max-w-[240px]">
              {ledgerName ?? '账本成员'}
            </h2>
            <p className="text-xs text-text-tertiary">共 {memberCount} 位成员</p>
          </div>
        </div>

        {/* 成员列表状态区 */}
        <div className="space-y-2">
          {state === 'loading' && <MemberListSkeleton />}

          {state === 'error' && (
            <div className="rounded-2xl border border-app-border bg-app-card p-6 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-rose-600 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                <span>加载成员失败</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                重试
              </Button>
            </div>
          )}

          {state === 'ready' && (
            <MemberList
              members={members}
              currentUserId={currentUserId}
              canManage={canManage}
              pendingMemberId={pendingMemberId}
              onOpenActions={onOpenMemberActions}
            />
          )}
        </div>

        {/* 待处理邀请区块 */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary px-1">
            待处理邀请
          </h3>
          <InvitationList
            state={invitationState}
            invitations={invitations}
            onRevoke={onRevokeInvitation}
            pendingInvitationId={pendingInvitationId}
            onRetry={onRetryInvitations}
            notice={invitationNotice}
          />
        </div>

        {/* 权限说明 */}
        {!canManage && (
          <div className="flex items-center gap-2 rounded-xl border border-app-border bg-app-card-subtle p-3 text-xs text-text-muted">
            <Shield className="size-4 text-text-tertiary shrink-0" />
            <span>只有所有者可以管理成员与邀请</span>
          </div>
        )}

        {/* 转移 Owner 入口 */}
        {canTransfer && (
          <div className="rounded-2xl border border-app-border bg-app-card overflow-hidden">
            <button
              type="button"
              onClick={onTransfer}
              className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-app-card-subtle"
            >
              <span className="text-sm font-medium text-text-main">转移账本 Owner</span>
              <ChevronRight className="size-4 text-text-tertiary" />
            </button>
          </div>
        )}
      </div>
    </SecondaryLayout>
  );
}
