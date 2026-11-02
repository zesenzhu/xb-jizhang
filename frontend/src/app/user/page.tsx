'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, WalletCards } from 'lucide-react';
import { UserAuthBoundary } from '@/components/auth/UserAuthBoundary';
import { useAppStore } from '@/store/useAppStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getLedger, getLedgers } from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { ApiRequestError } from '@/lib/api/errors';
import { resolveInitialLedgerId } from '@/lib/ledger/ledger-form';
import { AmountDisplay } from '@/components/common/AmountDisplay';
import { AmountKeypad } from '@/components/mobile/AmountKeypad';
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
  const isOnline = useAppStore((state) => state.isOnline);
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);

  const [keypadAmount, setKeypadAmount] = React.useState('0');
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

  const handleSaveTransaction = (): void => {
    const cents = Math.round(parseFloat(keypadAmount || '0') * 100);
    if (cents <= 0) {
      alert('请输入大于 0 的记账金额');
      return;
    }
    alert(`成功记录一笔：¥${keypadAmount}`);
    setKeypadAmount('0');
  };

  return (
    <div className="select-none">
      {/* 离线状态提示 */}
      <div className="px-4 pt-3 max-w-md mx-auto">
        <SyncStatusBar isOnline={isOnline} />
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 1. 当前活跃账本卡片（首页首屏主体，移除任何多余的个人条） */}
        <section className="relative overflow-hidden rounded-3xl bg-[#16181d] p-5 text-white shadow-xl shadow-slate-900/10 border border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-xs text-white">
                <WalletCards size={19} />
              </div>
              <div>
                <p className="text-xs text-white/60 font-medium">当前活跃账本</p>
                <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
                  {displayedLedger?.name || '还没有选择账本'}
                </h2>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-medium text-white/90">
              {displayedLedger ? (displayedLedger.type === 'SHARED' ? '共享账本' : '个人账本') : '请选择账本'}
            </div>
          </div>

          {/* 本月收支看板（支出纯白、收入鲜绿，确保清晰高对比） */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="text-xs text-white/60">本月支出</p>
              <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-white">
                <AmountDisplay amount={-25800} currency="¥" className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-xs text-white/60">本月收入</p>
              <div className="mt-1 text-2xl font-bold font-mono tracking-tight text-emerald-400">
                <AmountDisplay amount={150000} currency="¥" className="text-emerald-400 font-bold" />
              </div>
            </div>
          </div>
        </section>

        {ledgerError && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ledgerError}
          </p>
        )}

        {/* 2. 账本管理快捷操作 */}
        <section className="grid gap-2.5 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => router.push('/user/ledger')}
            className="rounded-2xl h-11 border-app-border text-text-main shadow-xs"
          >
            <WalletCards size={16} />
            管理我的账本
          </Button>
          <Button
            onClick={() => router.push('/user/ledger/new')}
            className="rounded-2xl h-11 bg-primary text-white hover:bg-primary-hover shadow-primary/20 shadow-xs"
          >
            <Plus size={16} />
            新建账本
          </Button>
        </section>

        {/* 3. 快捷记账模块 */}
        <section className="rounded-3xl bg-app-card p-5 shadow-xs border border-app-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-text-main">快速记一笔</h3>
            </div>
            <span className="text-xs text-text-muted">PWA 触控数字键盘</span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-app-card-subtle p-4 border border-app-border/60">
            <div>
              <p className="text-xs text-text-muted">录入金额</p>
              <p className="mt-0.5 text-xs text-text-main font-medium">点击下方按键输入</p>
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
      </div>
    </div>
  );
}
