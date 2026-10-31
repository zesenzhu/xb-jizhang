'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Plus, RefreshCw, WalletCards } from 'lucide-react';
import { ApiRequestError } from '@/lib/api/errors';
import { getLedgers } from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { validateLedgerName } from '@/lib/ledger/ledger-form';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LedgerBadge } from '@/components/common/LedgerBadge';

export function LedgerList(): React.JSX.Element {
  const router = useRouter();
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const [ledgers, setLedgers] = React.useState<LedgerSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const loadLedgers = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await getLedgers();
      setLedgers(result.items);
      if (!currentLedgerId && result.items[0]) setCurrentLedgerId(result.items[0].id);
    } catch (error: unknown) {
      setErrorMessage(error instanceof ApiRequestError ? error.message : '账本加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [currentLedgerId, setCurrentLedgerId]);

  React.useEffect(() => {
    void Promise.resolve().then(() => loadLedgers());
  }, [loadLedgers]);

  const selectLedger = (ledger: LedgerSummary): void => {
    setCurrentLedgerId(ledger.id);
    router.push(`/user/ledger/${encodeURIComponent(ledger.id)}`);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">用户工作区</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">我的账本</h1>
          <p className="mt-1 text-sm text-slate-500">切换账本后，首页和后续业务都会使用当前账本。</p>
        </div>
        <Button onClick={() => router.push('/user/ledger/new')}>
          <Plus size={16} />
          新建账本
        </Button>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-12 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          正在加载账本...
        </div>
      )}

      {!isLoading && errorMessage && (
        <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <p className="text-sm">{errorMessage}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadLedgers()}>
            <RefreshCw size={14} />
            重新加载
          </Button>
        </section>
      )}

      {!isLoading && !errorMessage && ledgers.length === 0 && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <WalletCards className="mx-auto size-10 text-slate-300" />
          <h2 className="mt-4 text-base font-semibold text-slate-900">还没有可用账本</h2>
          <p className="mt-1 text-sm text-slate-500">创建一个个人账本，或等待其他成员邀请你加入。</p>
          <Button className="mt-5" onClick={() => router.push('/user/ledger/new')}>
            <Plus size={16} />
            创建第一个账本
          </Button>
        </section>
      )}

      {!isLoading && !errorMessage && ledgers.length > 0 && (
        <div className="grid gap-3">
          {ledgers.map((ledger) => (
            <button
              key={ledger.id}
              type="button"
              onClick={() => selectLedger(ledger)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-slate-900">{ledger.name}</span>
                  {ledger.id === currentLedgerId && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      当前账本
                    </span>
                  )}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <LedgerBadge type={ledger.type} />
                  <LedgerBadge role={ledger.memberRole} />
                  <span className="text-xs text-slate-400">{ledger.defaultCurrency}</span>
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

export function CreateLedgerForm(): React.JSX.Element {
  const router = useRouter();
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const validationError = validateLedgerName(name);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const { createLedger } = await import('@/lib/api/ledger-api');
      const ledger = await createLedger({ name: name.trim(), type });
      setCurrentLedgerId(ledger.id);
      router.replace(`/user/ledger/${encodeURIComponent(ledger.id)}`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof ApiRequestError ? error.message : '创建账本失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-emerald-700">账本设置</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">新建账本</h1>
        <p className="mt-2 text-sm text-slate-500">创建后你会自动成为 Owner，之后可以邀请其他成员。</p>
        {errorMessage && <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}
        <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
          <div>
            <label htmlFor="ledger-name" className="mb-1.5 block text-sm font-medium text-slate-700">账本名称</label>
            <Input id="ledger-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：家庭账本" disabled={isSaving} />
          </div>
          <div>
            <label htmlFor="ledger-type" className="mb-1.5 block text-sm font-medium text-slate-700">账本类型</label>
            <select id="ledger-type" value={type} onChange={(event) => setType(event.target.value as 'PERSONAL' | 'SHARED')} disabled={isSaving} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20">
              <option value="PERSONAL">个人账本</option>
              <option value="SHARED">共享账本</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving}>取消</Button>
            <Button type="submit" isLoading={isSaving} loadingText="创建中...">创建账本</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
