'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, Shield, Sparkles, WalletCards } from 'lucide-react';
import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';
import { logoutUser } from '@/lib/api/user-auth-api';
import { useAppStore } from '@/store/useAppStore';
import { useUserAuthStore } from '@/store/userAuthStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getLedger, getLedgers } from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { ApiRequestError } from '@/lib/api/errors';
import { resolveInitialLedgerId } from '@/lib/ledger/ledger-form';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { AmountKeypad } from '@/components/mobile/AmountKeypad';
import { MobileBottomNav, type NavTab } from '@/components/mobile/MobileBottomNav';
import { SyncStatusBar } from '@/components/mobile/SyncStatusBar';
import { Button } from '@/components/ui/button';

export default function UserHomePage(): React.JSX.Element {
  return (
    <UserAuthBoundary>
      <UserHomeContent />
    </UserAuthBoundary>
  );
}

function UserHomeContent(): React.JSX.Element {
  const router = useRouter();
  const user = useUserAuthStore((state) => state.currentUser);
  const clearUser = useUserAuthStore((state) => state.clear);
  const isOnline = useAppStore((state) => state.isOnline);
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const clearCurrentLedger = useWorkspaceStore((state) => state.clear);

  const [activeTab, setActiveTab] = React.useState<NavTab>('home');
  const [keypadAmount, setKeypadAmount] = React.useState('0');
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [activeLedger, setActiveLedger] = React.useState<LedgerSummary | null>(null);
  const [ledgerError, setLedgerError] = React.useState<string | null>(null);
  const displayedLedger = currentLedgerId && activeLedger?.id === currentLedgerId ? activeLedger : null;

  React.useEffect(() => {
    if (!currentLedgerId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLedgerError(null);
      return getLedger(currentLedgerId)
        .then((ledger) => {
          if (active) setActiveLedger(ledger);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setActiveLedger(null);
          setLedgerError(error instanceof ApiRequestError ? error.message : '账本加载失败，请稍后重试');
        });
    });
    return () => {
      active = false;
    };
  }, [currentLedgerId]);

  React.useEffect(() => {
    if (currentLedgerId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      return getLedgers()
        .then((result) => {
          const initialLedgerId = resolveInitialLedgerId(result.items, currentLedgerId);
          if (active && initialLedgerId) useWorkspaceStore.getState().setCurrentLedgerId(initialLedgerId);
        })
        .catch(() => {
          // 首页允许在账本列表暂时不可用时继续展示登录后的基础操作。
        });
    });
    return () => {
      active = false;
    };
  }, [currentLedgerId]);

  const handleLogout = async (): Promise<void> => {
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

  const handleSaveTransaction = (): void => {
    const cents = Math.round(parseFloat(keypadAmount || '0') * 100);
    if (cents <= 0) {
      alert('请输入大于 0 的记账金额');
      return;
    }
    alert(`成功记录一笔：¥${keypadAmount}`);
    setKeypadAmount('0');
  };

  // 用户首字头像
  const avatarText = user?.nickname?.slice(0, 1) || user?.username?.slice(0, 1)?.toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 select-none">
      {/* 离线状态提示 */}
      <div className="px-4 pt-3 max-w-md mx-auto">
        <SyncStatusBar isOnline={isOnline} />
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 顶部个人栏 */}
        <header className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-xs border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-ios-blue to-blue-600 text-white font-bold text-base shadow-sm">
              {avatarText}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900">
                  {user?.nickname || user?.username}
                </p>
                <span className="text-[10px] rounded-full bg-blue-50 px-2 py-0.5 text-ios-blue font-medium border border-blue-200/60">
                  已登录
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">@{user?.username}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            isLoading={isLoggingOut}
            className="text-slate-500 hover:text-rose-600 gap-1 rounded-xl"
            title="退出登录"
          >
            <LogOut size={16} />
            <span className="text-xs">退出</span>
          </Button>
        </header>

        {/* 当前账本卡片 */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-5 text-white shadow-xl shadow-blue-950/20 border border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
                <WalletCards size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium">当前活跃账本</p>
                <h2 className="text-lg font-bold tracking-tight">
                  {displayedLedger?.name || '还没有选择账本'}
                </h2>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-medium text-white">
              {displayedLedger ? (displayedLedger.type === 'SHARED' ? '共享账本' : '个人账本') : '请选择账本'}
            </div>
          </div>

          {/* 本月结余简要看板 */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
            <div>
              <p className="text-xs text-slate-300">本月支出</p>
              <div className="mt-0.5 text-xl font-bold font-mono">
                <AmountDisplay amount={-25800} currency="¥" className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-300">本月收入</p>
              <div className="mt-0.5 text-xl font-bold font-mono">
                <AmountDisplay amount={150000} currency="¥" className="text-ios-blue" />
              </div>
            </div>
          </div>
        </section>

        {ledgerError && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ledgerError}
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={() => router.push('/user/ledger')}>
            <WalletCards size={16} />
            管理我的账本
          </Button>
          <Button onClick={() => router.push('/user/ledger/new')}>
            <Plus size={16} />
            新建账本
          </Button>
        </section>

        {/* 快捷记账模块 */}
        <section className="rounded-3xl bg-white p-5 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-ios-blue" />
              <h3 className="text-sm font-semibold text-slate-900">快速记一笔</h3>
            </div>
            <span className="text-xs text-slate-400">PWA 定制数字键盘</span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <p className="text-xs text-slate-400">录入金额</p>
              <p className="mt-0.5 text-xs text-slate-500">点击下方按键输入</p>
            </div>
            <AmountDisplay
              amount={Math.round(parseFloat(keypadAmount || '0') * 100)}
              size="2xl"
              colorSemantic="colored"
              type="EXPENSE"
            />
          </div>

          <AmountKeypad
            value={keypadAmount}
            onChange={setKeypadAmount}
            onSubmit={handleSaveTransaction}
            submitText="保存账单"
          />
        </section>

        {/* 账户与安全信息卡片 */}
        <section className="rounded-3xl bg-white p-4 shadow-xs border border-slate-200/80 text-xs text-slate-500 space-y-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <Shield size={14} className="text-ios-blue" />
            <span>会话安全提示</span>
          </div>
          <p className="leading-relaxed">
            您已通过 HttpOnly 令牌登录，离线新增的账单将在网络恢复后自动提交到云端对应账本中。
          </p>
        </section>
      </div>

      {/* 移动端固定底部导航 */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickAdd={() => {
          window.scrollTo({ top: 120, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
