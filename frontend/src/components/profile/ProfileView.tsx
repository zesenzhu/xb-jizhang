'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProfileEntryList, type ProfileEntry } from '@/components/profile/ProfileEntryList';
import { LogOut } from 'lucide-react';

export interface ProfileViewProps {
  user: {
    nickname: string | null;
    username: string;
    createdAt: string;
  } | null;
  entries: readonly ProfileEntry[];
  invitationBadge?: number | null;
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function ProfileView({
  user,
  entries,
  invitationBadge,
  isLoggingOut,
  onLogout,
}: ProfileViewProps): React.JSX.Element {
  const displayName = user ? (user.nickname ?? user.username) : '未登录';
  const initial = (displayName.trim()[0] ?? '?').toUpperCase();

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      })
    : '';

  // 映射条目，将 invitationBadge 注入对应的 mail 项（若需要）
  const enrichedEntries = React.useMemo(() => {
    return entries.map((e) => {
      if (e.key === 'invitations' || e.icon === 'mail') {
        const badgeVal = invitationBadge && invitationBadge > 0 ? String(invitationBadge) : e.badge;
        return { ...e, badge: badgeVal };
      }
      return e;
    });
  }, [entries, invitationBadge]);

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* 顶部标题「我的」 */}
      <div className="px-1 pt-2">
        <h1 className="text-xl font-bold text-text-main">我的</h1>
      </div>

      {/* 用户卡 */}
      <div className="rounded-2xl border border-app-border bg-app-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-4">
          {/* 头像圆 */}
          <div className="size-14 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-app-border">
            <span>{initial}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-text-main truncate">
                {displayName}
              </span>
              <Badge variant="secondary" className="text-xs px-2 py-0 font-normal">
                普通用户
              </Badge>
            </div>
            <div className="text-xs text-text-tertiary">
              @{user?.username ?? '---'}
            </div>
          </div>
        </div>

        {joinedDate && (
          <div className="text-xs text-text-muted border-t border-app-divider pt-3">
            记账始于 {joinedDate}
          </div>
        )}
      </div>

      {/* ProfileEntryList 分组入口 */}
      <div className="space-y-2">
        <ProfileEntryList entries={enrichedEntries} />
      </div>

      {/* 退出登录按钮 */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          isLoading={isLoggingOut}
          onClick={onLogout}
          className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100"
        >
          <LogOut className="size-4 mr-2" aria-hidden="true" />
          <span>退出登录</span>
        </Button>
      </div>

      {/* 版本与安全小字 */}
      <div className="text-center space-y-1 py-2">
        <p className="text-xs text-text-tertiary">小宝记账 · v2.0</p>
        <p className="text-[11px] text-text-tertiary">
          数据本地缓存与端到端传输加密保护
        </p>
      </div>
    </div>
  );
}
