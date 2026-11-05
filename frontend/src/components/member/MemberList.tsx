'use client';

import * as React from 'react';
import { MoreHorizontal, Loader2 } from 'lucide-react';
import type { LedgerMemberSummary } from '@/lib/api/member-types';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MemberListProps {
  members: readonly LedgerMemberSummary[];
  currentUserId: string | null;
  canManage: boolean;
  pendingMemberId: string | null;
  onOpenActions: (m: LedgerMemberSummary) => void;
}

export function MemberList({
  members,
  currentUserId,
  canManage,
  pendingMemberId,
  onOpenActions,
}: MemberListProps): React.JSX.Element {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-card p-8 text-center text-text-muted text-sm">
        暂无成员
      </div>
    );
  }

  return (
    <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
      {members.map((member) => {
        const isSelf = Boolean(currentUserId && member.user.id === currentUserId);
        const displayName = member.user.nickname ?? member.user.username;
        const initial = (displayName.trim()[0] ?? '?').toUpperCase();
        const joinedDate = member.joinedAt
          ? new Date(member.joinedAt).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
            })
          : '';
        const isPending = pendingMemberId === member.id;
        const showMoreBtn = canManage && !isSelf;

        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 gap-3 transition-colors hover:bg-app-card-subtle/50"
          >
            {/* 头像 + 信息 */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* 头像圆（avatar 有则 <img>，否则首字） */}
              <div className="size-10 rounded-full bg-primary/10 text-primary font-medium flex items-center justify-center shrink-0 overflow-hidden text-sm select-none border border-app-border">
                {member.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.user.avatar}
                    alt={displayName}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>

              {/* 昵称 + 角色 + 本人标记 + 加入时间 */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-main truncate max-w-[140px]">
                    {displayName}
                  </span>
                  <LedgerBadge role={member.role} />
                  {isSelf && (
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-0 border-primary/30 text-primary bg-primary-subtle"
                    >
                      本人
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-text-tertiary">
                  加入于 {joinedDate}
                </div>
              </div>
            </div>

            {/* 操作菜单按钮：仅 canManage 且 非本人 时渲染 */}
            {showMoreBtn && (
              <button
                type="button"
                aria-label="成员操作"
                disabled={isPending}
                onClick={() => onOpenActions(member)}
                className={cn(
                  'size-9 rounded-xl flex items-center justify-center text-text-muted transition-colors shrink-0',
                  'hover:bg-app-card-subtle hover:text-text-main active:bg-app-card-subtle/80',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <MoreHorizontal className="size-5" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
