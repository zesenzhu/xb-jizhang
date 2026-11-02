'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  LogOut,
  Moon,
  Palette,
  Shield,
  Smartphone,
  User as UserIcon,
  WalletCards,
} from 'lucide-react';
import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';
import { logoutUser } from '@/lib/api/user-auth-api';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { Button } from '@/components/ui/button';

export default function UserProfilePage(): React.JSX.Element {
  return (
    <UserAuthBoundary>
      <UserProfileContent />
    </UserAuthBoundary>
  );
}

function UserProfileContent(): React.JSX.Element {
  const router = useRouter();
  const user = useUserAuthStore((state) => state.currentUser);
  const clearUser = useUserAuthStore((state) => state.clear);
  const clearCurrentLedger = useWorkspaceStore((state) => state.clear);

  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async (): Promise<void> => {
    if (!window.confirm('确定要退出当前登录账号吗？')) {
      return;
    }

    try {
      setIsLoggingOut(true);
      try {
        await logoutUser();
      } finally {
        clearUser();
        clearCurrentLedger();
        router.replace('/user/login');
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const avatarText =
    user?.nickname?.slice(0, 1) || user?.username?.slice(0, 1)?.toUpperCase() || 'U';

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
      })
    : '近期加入';

  return (
    <div className="min-h-screen bg-app-bg text-text-main pb-24 select-none">
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 顶部简易导航栏 */}
        <div className="flex items-center justify-between py-1">
          <button
            type="button"
            onClick={() => router.push('/user')}
            className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-main"
          >
            <ChevronLeft size={18} />
            <span>返回记账</span>
          </button>
          <h1 className="text-base font-semibold text-text-main">个人中心</h1>
          <div className="w-16" />
        </div>

        {/* 1. 个人资料卡片 */}
        <section className="rounded-3xl bg-app-card p-5 shadow-xs border border-app-border space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-white font-bold text-2xl shadow-md shadow-primary/20">
              {avatarText}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-main truncate">
                  {user?.nickname || user?.username}
                </h2>
                <span className="text-[10px] rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium border border-primary/20 shrink-0">
                  普通用户
                </span>
              </div>
              <p className="text-xs text-text-muted font-mono mt-0.5">@{user?.username}</p>
              <p className="text-[11px] text-text-tertiary mt-1">记账始于 {memberSince}</p>
            </div>
          </div>
        </section>

        {/* 2. 账本管理 Group */}
        <section className="rounded-3xl bg-app-card shadow-xs border border-app-border overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border/60">
            <span className="text-xs font-semibold text-text-muted">账本与财务空间</span>
          </div>
          <div className="divide-y divide-app-border/50">
            <button
              type="button"
              onClick={() => router.push('/user/ledger')}
              className="flex w-full items-center justify-between p-4 text-left transition hover:bg-app-card-subtle/50 active:bg-app-card-subtle"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-primary">
                  <WalletCards size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-main">账本管理</p>
                  <p className="text-xs text-text-muted">切换活跃账本或邀请成员协作</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-text-tertiary" />
            </button>
          </div>
        </section>

        {/* 3. 外观与主题偏好 Group（为后续主题切换预留） */}
        <section className="rounded-3xl bg-app-card shadow-xs border border-app-border overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border/60">
            <span className="text-xs font-semibold text-text-muted">外观与个性化</span>
          </div>
          <div className="divide-y divide-app-border/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <Palette size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-main">当前主题色</p>
                  <p className="text-xs text-text-muted">已构建全局语义变量架构</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex size-4 rounded-full bg-primary shadow-xs ring-2 ring-primary/20" />
                <span className="text-xs font-medium text-primary">iOS 科技蓝</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Moon size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-main">深浅外观</p>
                  <p className="text-xs text-text-muted">跟随操作系统深色模式自动适配</p>
                </div>
              </div>
              <span className="text-xs text-text-muted">自动跟随</span>
            </div>
          </div>
        </section>

        {/* 4. 应用与关于 Group */}
        <section className="rounded-3xl bg-app-card shadow-xs border border-app-border overflow-hidden">
          <div className="divide-y divide-app-border/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Smartphone size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-main">小宝记账 PWA</p>
                  <p className="text-xs text-text-muted">支持离线账单暂存与自动同步</p>
                </div>
              </div>
              <span className="text-xs font-mono text-text-muted">v0.1.0</span>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-main">会话安全保护</p>
                  <p className="text-xs text-text-muted">HttpOnly 双令牌会话安全隔离</p>
                </div>
              </div>
              <span className="text-xs text-emerald-600 font-medium">保护中</span>
            </div>
          </div>
        </section>

        {/* 5. 退出登录按钮（经典 iOS 醒目通栏设计） */}
        <div className="pt-2">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => void handleLogout()}
            isLoading={isLoggingOut}
            className="w-full h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 shadow-xs font-semibold text-sm active:bg-rose-200"
          >
            <LogOut size={16} />
            <span>退出当前账号</span>
          </Button>
          <p className="text-center text-[11px] text-text-tertiary mt-2">
            退出后将安全清除本设备上的临时会话令牌
          </p>
        </div>
      </div>

      {/* 底部导航栏（高亮“我的”Tab） */}
      <MobileBottomNav
        activeTab="profile"
        onQuickAdd={() => {
          router.push('/user');
        }}
      />
    </div>
  );
}

