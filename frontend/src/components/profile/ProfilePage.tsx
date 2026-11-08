'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/errors';
import { getCurrentUser, logoutUser } from '@/lib/api/user-auth-api';
import { changePassword, updateCurrentUser } from '@/lib/api/user-api';
import { getMyInvitations } from '@/lib/api/invitation-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useBillMemoryStore } from '@/store/billMemoryStore';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useInvitationSessionStore } from '@/lib/ledger/invitation-session';
import { BottomSheet, SHEET_BODY_SCROLL_ALONE } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ProfileView } from '@/components/profile/ProfileView';
import type { ProfileEntry } from '@/components/profile/ProfileEntryList';

type Panel = 'profile' | 'security' | 'about' | null;

function errorText(error: unknown, fallback = '操作失败，请稍后重试'): string | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) return error.message;
  return fallback;
}

export function ProfilePage(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useUserAuthStore((state) => state.currentUser);
  const setCurrentUser = useUserAuthStore((state) => state.setCurrentUser);
  const clearUser = useUserAuthStore((state) => state.clear);
  const clearWorkspace = useWorkspaceStore((state) => state.clear);
  const clearBillMemory = useBillMemoryStore((state) => state.clear);
  const clearInvitationSession = useInvitationSessionStore((state) => state.clear);

  const [panel, setPanel] = React.useState<Panel>(null);
  const [nickname, setNickname] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  /**
   * 用户资料以服务端为准：登录响应里的 `nickname` 可能已经被其他设备改过。
   * 直接写回 auth store，个人页头部与「我的账本」等处的称呼保持一致。
   */
  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
    staleTime: queryStaleTime.currentUser,
  });

  React.useEffect(() => {
    if (userQuery.data) setCurrentUser(userQuery.data);
  }, [userQuery.data, setCurrentUser]);

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: getMyInvitations,
    staleTime: queryStaleTime.invitations,
  });
  const invitationCount = invitationsQuery.data?.length ?? 0;

  const clearSessionAndRedirect = async (): Promise<void> => {
    queryClient.removeQueries({
      predicate: (query) => {
        const root = query.queryKey[0];
        return root === 'user' || root === 'ledgers' || root === 'ledger';
      },
    });
    clearUser();
    clearWorkspace();
    clearBillMemory();
    clearInvitationSession();
    router.replace('/user/login');
  };

  const profileMutation = useMutation({
    mutationFn: () =>
      updateCurrentUser({
        nickname: nickname.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      }),
    onSuccess: (updated) => {
      setCurrentUser(updated);
      queryClient.setQueryData(queryKeys.currentUser, updated);
      setPanel(null);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      // 服务端已吊销全部刷新会话：继续留在页面上只会拿到一串 401。
      await clearSessionAndRedirect();
    },
  });

  const handleLogout = async (): Promise<void> => {
    if (!window.confirm('确定要退出当前登录账号吗？')) return;
    setIsLoggingOut(true);
    try {
      await logoutUser();
    } catch {
      // 退出接口失败也要清本地会话：留着 token 只会让用户卡在无法鉴权的状态。
    } finally {
      await clearSessionAndRedirect();
      setIsLoggingOut(false);
    }
  };

  const entries: ProfileEntry[] = [
    {
      key: 'profile',
      label: '个人资料',
      description: '昵称与账号信息',
      icon: 'user',
      // 打开时把当前昵称灌进输入框：放在事件里而不是 effect，避免级联渲染。
      onClick: () => {
        setNickname(user?.nickname ?? '');
        setEmail(user?.email ?? '');
        profileMutation.reset();
        setPanel('profile');
      },
    },
    {
      key: 'security',
      label: '账号与安全',
      description: '修改登录密码',
      icon: 'shield',
      onClick: () => {
        setCurrentPassword('');
        setNewPassword('');
        passwordMutation.reset();
        setPanel('security');
      },
    },
    {
      key: 'invitations',
      label: '我的邀请',
      description: '查看别人发给你的账本邀请',
      icon: 'mail',
      onClick: () => router.push('/user/invitations'),
    },
    { key: 'about', label: '帮助与关于', description: '版本、数据口径与说明', icon: 'help', onClick: () => setPanel('about') },
  ];

  return (
    <>
      <ProfileView
        user={user ? { nickname: user.nickname, username: user.username, createdAt: user.createdAt } : null}
        entries={entries}
        invitationBadge={invitationCount > 0 ? invitationCount : null}
        isLoggingOut={isLoggingOut}
        onLogout={() => void handleLogout()}
      />

      <BottomSheet
        open={panel === 'profile'}
        onOpenChange={(open) => {
          if (!open) {
            setPanel(null);
            profileMutation.reset();
          }
        }}
        title="个人资料"
      >
        <div className={cn(SHEET_BODY_SCROLL_ALONE, 'space-y-4')}>
          <div className="space-y-1.5">
            <label htmlFor="profile-nickname" className="block text-xs font-medium text-text-muted">
              昵称
            </label>
            <Input
              id="profile-nickname"
              value={nickname}
              maxLength={50}
              disabled={profileMutation.isPending}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="给自己取个昵称"
            />
            <p className="text-[11px] text-text-tertiary">用户名 @{user?.username ?? '—'} 不可修改。</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-email" className="block text-xs font-medium text-text-muted">
              邮箱
            </label>
            <Input
              id="profile-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              disabled={profileMutation.isPending}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="用于接收共享账本邀请"
            />
            <p className="text-[11px] text-text-tertiary">
              邀请会发送到该邮箱；补全或更换后回到“我的邀请”即可继续处理。
            </p>
          </div>

          {errorText(profileMutation.error) && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorText(profileMutation.error)}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPanel(null)}>
              取消
            </Button>
            <Button
              type="button"
              className="flex-1"
              isLoading={profileMutation.isPending}
              disabled={!nickname.trim()}
              onClick={() => profileMutation.mutate()}
            >
              保存
            </Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={panel === 'security'}
        onOpenChange={(open) => {
          if (!open) {
            setPanel(null);
            passwordMutation.reset();
          }
        }}
        title="账号与安全"
      >
        <div className={cn(SHEET_BODY_SCROLL_ALONE, 'space-y-4')}>
          <div className="space-y-1.5">
            <label htmlFor="current-password" className="block text-xs font-medium text-text-muted">
              当前密码
            </label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              disabled={passwordMutation.isPending}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-xs font-medium text-text-muted">
              新密码（至少 8 位）
            </label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              disabled={passwordMutation.isPending}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          {errorText(passwordMutation.error) && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorText(passwordMutation.error)}
            </p>
          )}

          <p className="text-[11px] text-text-tertiary">
            修改成功后需要用新密码重新登录，其他设备上的会话会一并失效。
          </p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setPanel(null)}>
              取消
            </Button>
            <Button
              type="button"
              className="flex-1"
              isLoading={passwordMutation.isPending}
              disabled={!currentPassword || newPassword.length < 8}
              onClick={() => passwordMutation.mutate()}
            >
              修改密码
            </Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={panel === 'about'}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        title="帮助与关于"
      >
        <div className={cn(SHEET_BODY_SCROLL_ALONE, 'space-y-3 text-xs leading-relaxed text-text-muted')}>
          <p>
            <span className="font-medium text-text-main">小宝记账</span>
            ：专注个人与共享账本的收支记录，金额一律以「分」为最小单位，前端不做二次聚合。
          </p>
          <p>统计口径以服务端计算结果为准；切换账本后会自动清理旧账本的本地缓存，避免看到过期数据。</p>
          <p>账本管理与切换入口在「账本」页顶部的切换按钮，本页不重复列出账本。</p>
        </div>
      </BottomSheet>
    </>
  );
}
