'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, WalletCards } from 'lucide-react';
import { getLedger } from '@/lib/api/ledger-api';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { SecondaryHeader } from '@/components/layout/SecondaryLayout';

export default function UserLedgerPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ ledgerId: string }>();
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const ledgerId = params.ledgerId;
  const ledgerQuery = useQuery({
    queryKey: queryKeys.ledgers.detail(ledgerId),
    queryFn: () => getLedger(ledgerId),
    staleTime: queryStaleTime.ledgers,
    enabled: Boolean(ledgerId),
  });
  const ledger = ledgerQuery.data;
  const errorMessage = ledgerQuery.isError && !ledgerQuery.data ? '账本加载失败，请稍后重试' : null;

  React.useEffect(() => {
    setCurrentLedgerId(ledgerId);
  }, [ledgerId, setCurrentLedgerId]);

  return (
    <div className="min-h-screen bg-app-bg text-text-main pb-safe select-none">
      <SecondaryHeader
        title={ledger?.name || '账本详情'}
        subtitle="账本空间"
        fallbackBackUrl="/user/ledger"
      />

      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {errorMessage && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700 space-y-3">
            <p className="text-sm">{errorMessage}</p>
            <Button variant="outline" size="sm" onClick={() => router.push('/user/ledger')}>
              返回账本列表
            </Button>
          </div>
        )}

        {!errorMessage && !ledger && (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-text-muted">
            <Loader2 className="size-4 animate-spin text-primary" />
            正在加载账本空间...
          </div>
        )}

        {ledger && (
          <>
            <section className="rounded-3xl bg-[#16181d] p-6 text-white shadow-xl shadow-slate-900/10 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">当前账本工作区</span>
                <span className="text-xs font-mono text-white/60">{ledger.defaultCurrency}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">{ledger.name}</h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <LedgerBadge type={ledger.type} />
                <LedgerBadge role={ledger.memberRole} />
              </div>
            </section>

            <section className="rounded-3xl bg-app-card p-5 shadow-xs border border-app-border space-y-3">
              <div className="flex items-center gap-2 text-text-main font-semibold text-sm">
                <Users size={16} className="text-primary" />
                <span>协作与成员</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {ledger.type === 'SHARED'
                  ? '这是一个共享账本，您可以邀请家庭成员或伙伴一起记账。'
                  : '这是您的私密个人账本，仅对您本人可见。'}
              </p>
              <div className="pt-2">
                <Button
                  className="w-full bg-primary text-white"
                  onClick={() => router.push('/user')}
                >
                  <WalletCards size={16} />
                  设为当前并返回首页
                </Button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
