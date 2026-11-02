'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, RefreshCw, WalletCards } from 'lucide-react';
import { ApiRequestError } from '@/lib/api/errors';
import { createLedger, getLedgers } from '@/lib/api/ledger-api';
import type { LedgerSummary } from '@/lib/api/ledger-types';
import { validateLedgerName } from '@/lib/ledger/ledger-form';
import { queryKeys, queryStaleTime } from '@/lib/query/query-config';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { SecondaryHeader } from '@/components/layout/SecondaryLayout';

/**
 * 账本管理 - 一级页面
 * 规范：与首页、个人中心一致，底部常驻 TabBar，顶部无返回按钮
 */
export function LedgerList(): React.JSX.Element {
  const router = useRouter();
  const currentLedgerId = useWorkspaceStore((state) => state.currentLedgerId);
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const ledgersQuery = useQuery({
    queryKey: queryKeys.ledgers.list(),
    queryFn: () => getLedgers(),
    staleTime: queryStaleTime.ledgers,
  });
  const ledgers = ledgersQuery.data?.items ?? [];
  const isLoading = ledgersQuery.isPending && !ledgersQuery.data;
  const errorMessage = ledgersQuery.isError && !ledgersQuery.data
    ? ledgersQuery.error instanceof ApiRequestError
      ? ledgersQuery.error.message
      : '账本加载失败，请稍后重试'
    : null;

  const selectLedger = (ledger: LedgerSummary): void => {
    setCurrentLedgerId(ledger.id);
    router.push(`/user/ledger/${encodeURIComponent(ledger.id)}`);
  };

  return (
    <div className="select-none">
      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* 一级页面顶部大标题（规范：无返回按钮，右侧放新建操作） */}
        <header className="flex items-center justify-between pt-2 pb-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main">我的账本</h1>
            <p className="text-xs text-text-muted mt-0.5">选择并切换当前使用的记账空间</p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/user/ledger/new')}
            className="h-9 rounded-2xl px-3 text-xs bg-primary text-white hover:bg-primary-hover shadow-xs gap-1"
          >
            <Plus size={15} />
            <span>新建账本</span>
          </Button>
        </header>

        {isLoading && (
          <div className="grid gap-3 pt-1">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-4 rounded-2xl border border-app-border bg-app-card p-4 shadow-xs animate-pulse"
              >
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-28 rounded-md bg-app-card-subtle" />
                    {idx === 0 && <div className="h-4 w-14 rounded-full bg-primary/20" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-14 rounded-full bg-app-card-subtle" />
                    <div className="h-4 w-12 rounded-full bg-app-card-subtle" />
                    <div className="h-3.5 w-8 rounded-md bg-app-card-subtle" />
                  </div>
                </div>
                <div className="size-4 rounded-full bg-app-card-subtle shrink-0" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && errorMessage && (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 space-y-3">
            <p className="text-sm">{errorMessage}</p>
            <Button variant="outline" size="sm" onClick={() => void ledgersQuery.refetch()} className="gap-1.5 border-rose-200">
              <RefreshCw size={14} />
              重新加载
            </Button>
          </section>
        )}

        {!isLoading && !errorMessage && ledgers.length === 0 && (
          <section className="rounded-3xl border border-dashed border-app-border bg-app-card px-6 py-12 text-center">
            <WalletCards className="mx-auto size-10 text-text-muted/40" />
            <h2 className="mt-4 text-base font-semibold text-text-main">还没有可用账本</h2>
            <p className="mt-1 text-xs text-text-muted">创建一个个人账本，或等待其他成员邀请你加入。</p>
            <Button className="mt-5 bg-primary text-white" onClick={() => router.push('/user/ledger/new')}>
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
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-app-border bg-app-card p-4 text-left shadow-xs transition active:scale-[0.99] hover:border-primary/40"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-text-main">{ledger.name}</span>
                    {ledger.id === currentLedgerId && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                        当前账本
                      </span>
                    )}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <LedgerBadge type={ledger.type} />
                    <LedgerBadge role={ledger.memberRole} />
                    <span className="text-xs text-text-muted font-mono">{ledger.defaultCurrency}</span>
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * 新建账本 - 二级页面
 * 规范：深层子页面，隐藏底部 TabBar，顶部带有吸顶返回导航栏
 */
export function CreateLedgerForm(): React.JSX.Element {
  const router = useRouter();
  const setCurrentLedgerId = useWorkspaceStore((state) => state.setCurrentLedgerId);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createLedger,
    onSuccess: (ledger) => {
      setCurrentLedgerId(ledger.id);
      queryClient.setQueryData(queryKeys.ledgers.detail(ledger.id), ledger);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all });
      router.replace(`/user/ledger/${encodeURIComponent(ledger.id)}`);
    },
  });
  const errorMessage = validationError ?? (createMutation.error instanceof ApiRequestError
    ? createMutation.error.message
    : createMutation.isError
      ? '创建账本失败，请稍后重试'
      : null);

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nameError = validateLedgerName(name);
    if (nameError) {
      setValidationError(nameError);
      return;
    }
    setValidationError(null);
    createMutation.reset();
    createMutation.mutate({ name: name.trim(), type });
  };

  return (
    <div className="min-h-screen bg-app-bg text-text-main pb-safe select-none">
      {/* 二级页面吸顶返回导航头 */}
      <SecondaryHeader
        title="新建账本"
        subtitle="账本设置"
        fallbackBackUrl="/user/ledger"
      />

      <main className="mx-auto max-w-md px-4 py-4">
        <div className="rounded-3xl border border-app-border bg-app-card p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-main">创建新财务空间</h2>
            <p className="mt-1 text-xs text-text-muted">创建后你会自动成为 Owner，之后可以邀请其他成员协作记账。</p>
          </div>

        {errorMessage && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 border border-rose-200">
              {errorMessage}
            </p>
          )}

          <form className="space-y-4 pt-1" onSubmit={(event) => void submit(event)}>
            <div>
              <label htmlFor="ledger-name" className="mb-1 block text-xs font-medium text-text-main">
                账本名称 <span className="text-rose-500">*</span>
              </label>
              <Input
                id="ledger-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：家庭账本、合租记账"
                disabled={createMutation.isPending}
                required
              />
            </div>

            <div>
              <label htmlFor="ledger-type" className="mb-1 block text-xs font-medium text-text-main">
                账本类型
              </label>
              <select
                id="ledger-type"
                value={type}
                onChange={(event) => setType(event.target.value as 'PERSONAL' | 'SHARED')}
                disabled={createMutation.isPending}
                className="h-10 w-full rounded-xl border border-app-border bg-app-card px-3 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="PERSONAL">个人账本（仅自己可见）</option>
                <option value="SHARED">共享账本（支持多人协同）</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={createMutation.isPending}>
                取消
              </Button>
              <Button type="submit" isLoading={createMutation.isPending} loadingText="创建中...">
                确认创建
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
