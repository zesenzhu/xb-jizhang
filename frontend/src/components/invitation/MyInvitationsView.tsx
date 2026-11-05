'use client';

import * as React from 'react';
import type { LedgerType } from '@/lib/api/ledger-types';
import { SecondaryLayout } from '@/components/layout/SecondaryLayout';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, MailCheck, ShieldAlert } from 'lucide-react';

export interface MyInvitationItem {
  id: string;
  ledgerName: string;
  ledgerType: LedgerType;
  role: 'EDITOR' | 'VIEWER';
  expiresAt: string;
}

export interface MyInvitationsViewProps {
  state: 'loading' | 'error' | 'empty' | 'ready';
  items: readonly MyInvitationItem[];
  errorMessage: string | null;
  onRetry: () => void;
  tokenPrompt: {
    token: string;
    onSubmit: (token: string) => void;
    isSubmitting: boolean;
    error: string | null;
    mode: 'accept' | 'decline';
    /** 切到「拒绝」；为空时不渲染拒绝入口 */
    onSwitchMode?: () => void;
  } | null;
}

export function MyInvitationsView({
  state,
  items,
  errorMessage,
  onRetry,
  tokenPrompt,
}: MyInvitationsViewProps): React.JSX.Element {
  const [tokenInput, setTokenInput] = React.useState(tokenPrompt?.token ?? '');
  const [appliedToken, setAppliedToken] = React.useState(tokenPrompt?.token ?? '');

  // URL 上的 token 变化时同步到输入框；渲染期比较避免 effect 里同步 setState。
  const nextToken = tokenPrompt?.token ?? '';
  if (appliedToken !== nextToken) {
    setAppliedToken(nextToken);
    if (nextToken) setTokenInput(nextToken);
  }

  return (
    <SecondaryLayout title="我的邀请" fallbackBackUrl="/user/profile">
      <div className="max-w-md mx-auto px-4 py-4 space-y-6">
        {/* Token 处理卡片（当 URL 或 props 传入 tokenPrompt 时渲染） */}
        {tokenPrompt ? (
          <div className="rounded-2xl border border-app-border bg-app-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
              <MailCheck className="size-5 text-primary" aria-hidden="true" />
              <span>处理邀请链接</span>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              检测到邀请凭证，请点击确认以{tokenPrompt.mode === 'accept' ? '加入账本' : '拒绝邀请'}。
            </p>

            {tokenPrompt.error && (
              <div
                className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{tokenPrompt.error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-tertiary">
                邀请凭证 Token
              </label>
              <Input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="请输入或粘贴 token"
                disabled={tokenPrompt.isSubmitting}
              />
            </div>

            <div className="pt-1">
              <Button
                type="button"
                className="w-full"
                variant={tokenPrompt.mode === 'decline' ? 'destructive' : 'default'}
                isLoading={tokenPrompt.isSubmitting}
                disabled={!tokenInput.trim() || tokenPrompt.isSubmitting}
                onClick={() => tokenPrompt.onSubmit(tokenInput.trim())}
              >
                {tokenPrompt.mode === 'accept' ? '接受邀请并加入' : '拒绝此邀请'}
              </Button>

              {tokenPrompt.onSwitchMode && !tokenPrompt.isSubmitting && (
                <button
                  type="button"
                  onClick={tokenPrompt.onSwitchMode}
                  className="mt-2 w-full text-center text-xs text-text-tertiary underline underline-offset-2"
                >
                  不想加入？改为拒绝此邀请
                </button>
              )}
            </div>
          </div>
        ) : (
          /* 说明卡：未提供 tokenPrompt 时展示 */
          <div className="rounded-2xl border border-app-border bg-app-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-text-main">
              <Info className="size-4 text-text-tertiary" aria-hidden="true" />
              <span>邀请处理说明</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              列表仅展示邀请信息；接受或拒绝需要使用完整的邀请链接（含验证 token）。若你收到了邀请链接，请直接点击该链接或在浏览器中打开。
            </p>
          </div>
        )}

        {/* 状态展示 */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary px-1">
            待处理的账本邀请 ({items.length})
          </h2>

          {state === 'loading' && (
            <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              ))}
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-2xl border border-app-border bg-app-card p-6 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-rose-600 font-medium">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage ?? '加载邀请列表失败'}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                重试
              </Button>
            </div>
          )}

          {state === 'empty' && (
            <div className="rounded-2xl border border-app-border bg-app-card p-8 text-center text-text-muted text-sm">
              暂无待处理邀请
            </div>
          )}

          {state === 'ready' && (
            <div className="divide-y divide-app-divider rounded-2xl border border-app-border bg-app-card overflow-hidden">
              {items.map((item) => {
                const expiryDate = item.expiresAt ? new Date(item.expiresAt) : null;
                const expiryText =
                  expiryDate && !isNaN(expiryDate.getTime())
                    ? `${expiryDate.getFullYear()}年${expiryDate.getMonth() + 1}月${expiryDate.getDate()}日 到期`
                    : '长期有效';

                return (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-main">
                          {item.ledgerName}
                        </span>
                        <LedgerBadge type={item.ledgerType} />
                      </div>
                      <LedgerBadge role={item.role} />
                    </div>

                    <div className="text-xs text-text-tertiary">
                      {expiryText}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SecondaryLayout>
  );
}
