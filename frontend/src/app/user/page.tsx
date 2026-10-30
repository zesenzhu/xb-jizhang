'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, PlusCircle, Shield, Sparkles, User as UserIcon, WalletCards } from 'lucide-react';
import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';
import { logoutUser } from '@/lib/api/user-auth-api';
import { useAppStore } from '@/store/useAppStore';
import { useUserAuthStore } from '@/store/userAuthStore';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { LedgerBadge } from '@/components/common/LedgerBadge';
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
  const activeLedger = useAppStore((state) => state.activeLedger);
  const isOnline = useAppStore((state) => state.isOnline);
  const setActiveLedger = useAppStore((state) => state.setActiveLedger);

  const [activeTab, setActiveTab] = React.useState<NavTab>('home');
  const [keypadAmount, setKeypadAmount] = React.useState('0');
  const [showKeypadDrawer, setShowKeypadDrawer] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async (): Promise<void> => {
    try {
      setIsLoggingOut(true);
      try {
        await logoutUser();
      } finally {
        clearUser();
        setActiveLedger(null);
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
    setShowKeypadDrawer(false);
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
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-base shadow-sm">
              {avatarText}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900">
                  {user?.nickname || user?.username}
                </p>
                <span className="text-[10px] rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium border border-emerald-200/60">
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
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-700/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
                <WalletCards size={18} />
              </div>
              <div>
                <p className="text-xs text-emerald-100 font-medium">当前活跃账本</p>
                <h2 className="text-lg font-bold tracking-tight">
                  {activeLedger?.name || '默认个人账本'}
                </h2>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-medium text-white">
              {activeLedger?.type === 'SHARED' ? '共享账本' : '个人账本'}
            </div>
          </div>

          {/* 本月结余简要看板 */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
            <div>
              <p className="text-xs text-emerald-100/80">本月支出</p>
              <div className="mt-0.5 text-xl font-bold font-mono">
                <AmountDisplay amount={-25800} currency="¥" className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-xs text-emerald-100/80">本月收入</p>
              <div className="mt-0.5 text-xl font-bold font-mono">
                <AmountDisplay amount={150000} currency="¥" className="text-emerald-200" />
              </div>
            </div>
          </div>
        </section>

        {/* 快捷记账模块 */}
        <section className="rounded-3xl bg-white p-5 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" />
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
            <Shield size={14} className="text-emerald-600" />
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
          // 点击突出记账按钮聚焦数字键盘
          window.scrollTo({ top: 120, behavior: 'smooth' });
        }}
      />
    </div>
  );
}

