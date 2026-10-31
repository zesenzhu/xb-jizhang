'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Users, WalletCards } from 'lucide-react';
import { ApiRequestError } from '@/lib/api/errors';
import { getLedger } from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { LedgerBadge } from '@/components/common/LedgerBadge';

interface LedgerEntryProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function UserLedgerPage(): React.JSX.Element {
  const router = useRouter();
  const params = useParams<{ ledgerId: string }>();
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const [ledger, setLedger] = React.useState<LedgerSummary | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ledgerId = params.ledgerId;
    setCurrentLedgerId(ledgerId);
    let active = true;
    void getLedger(ledgerId)
      .then((result) => {
        if (active) setLedger(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(error instanceof ApiRequestError ? error.message : '账本加载失败，请稍后重试');
      });
    return () => {
      active = false;
    };
  }, [params.ledgerId, setCurrentLedgerId]);

  if (errorMessage) {
    return <main className="mx-auto max-w-3xl px-4 py-8"><p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{errorMessage}</p><Button className="mt-4" variant="outline" onClick={() => router.push('/user/ledger')}>返回账本列表</Button></main>;
  }

  if (!ledger) {
    return <main className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />正在加载账本...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push('/user/ledger')}><ArrowLeft size={16} />账本列表</Button>
        <Button variant="outline" onClick={() => router.push('/user')}><WalletCards size={16} />返回首页</Button>
      </div>
      <section className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-600 p-6 text-white shadow-lg shadow-emerald-700/20">
        <p className="text-sm text-emerald-100">当前账本工作区</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{ledger.name}</h1>
          <LedgerBadge type={ledger.type} className="border-0 bg-white/20 text-white" />
          <LedgerBadge role={ledger.memberRole} className="border-0 bg-white/20 text-white" />
        </div>
        <p className="mt-3 text-sm text-emerald-100">默认货币：{ledger.defaultCurrency} · 账本数据按成员权限加载</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: '账单', description: '下一步接入收支明细', icon: WalletCards },
          { title: '账户与分类', description: '下一步接入基础资料', icon: WalletCards },
          { title: '成员管理', description: '邀请和角色管理', icon: Users },
        ].map(({ title, description, icon: Icon }: LedgerEntryProps) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <Icon className="size-5 text-emerald-600" />
            <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
