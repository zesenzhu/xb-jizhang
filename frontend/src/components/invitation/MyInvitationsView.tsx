'use client';

import * as React from 'react';
import type { LedgerType } from '@/lib/api/ledger-types';
import type { InvitationDetail, InvitationPreview } from '@/lib/api/invitation-types';
import { SecondaryLayout } from '@/components/layout/SecondaryLayout';
import { LedgerBadge } from '@/components/common/LedgerBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Info, MailCheck } from 'lucide-react';

export interface MyInvitationItem {
  id: string;
  ledgerName: string;
  ledgerType: LedgerType;
  inviterName: string;
  role: 'EDITOR' | 'VIEWER';
  expiresAt: string;
}

export interface MyInvitationsViewProps {
  state: 'loading' | 'error' | 'empty' | 'ready';
  items: readonly MyInvitationItem[];
  errorMessage: string | null;
  onRetry: () => void;
  tokenState: 'idle' | 'loading' | 'error' | 'ready';
  tokenDetail: InvitationDetail | null;
  tokenError: string | null;
  onTokenRetry: () => void;
  onRespond: (invitationId: string, action: 'accept' | 'decline') => void;
  pendingInvitationId: string | null;
  onGoProfile: () => void;
  onGoLedger: (ledgerId: string) => void;
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '有效期未知';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 到期`;
}

function statusText(status: InvitationDetail['status']): string {
  switch (status) {
    case 'ACCEPTED':
      return '邀请已接受';
    case 'DECLINED':
      return '邀请已拒绝';
    case 'EXPIRED':
      return '邀请已过期';
    case 'REVOKED':
      return '邀请已撤销';
    default:
      return '待处理';
  }
}

function inviterName(invitation: InvitationDetail): string {
  return invitation.inviter?.nickname?.trim() || invitation.inviter?.username || '账本成员';
}

export interface PublicInvitationPreviewProps {
  state: 'loading' | 'error' | 'ready';
  preview: InvitationPreview | null;
  errorMessage: string | null;
  onRetry: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

/** 未登录时的邀请说明：只展示公开字段，不暴露账本内容。 */
export function PublicInvitationPreview({
  state,
  preview,
  errorMessage,
  onRetry,
  onLogin,
  onRegister,
}: PublicInvitationPreviewProps): React.JSX.Element {
  return (
    <SecondaryLayout title="我的邀请" fallbackBackUrl="/user">
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        <section className="rounded-2xl border border-app-border bg-app-card p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
            <MailCheck className="size-5 text-primary" aria-hidden="true" />
            <span>账本邀请</span>
          </div>

          {state === 'loading' && (
            <div className="mt-4 space-y-2" aria-label="正在加载邀请">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-3 w-52 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          )}

          {state === 'error' && (
            <div className="mt-3 space-y-3">
              <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700" role="alert">
                {errorMessage ?? '邀请链接无效或不可用'}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                重新加载
              </Button>
            </div>
          )}

          {state === 'ready' && !preview && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-text-muted">登录后查看别人发给你的账本邀请。</p>
              <Button type="button" className="w-full" onClick={onLogin}>
                去登录
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={onRegister}>
                注册新账号
              </Button>
            </div>
          )}

          {state === 'ready' && preview && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-base font-semibold text-text-main">{preview.ledgerName}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {preview.inviterName} 邀请你以{' '}
                  {preview.role === 'EDITOR' ? '记账协作' : '只读观察'} 身份加入。
                </p>
                <p className="mt-1 text-xs text-text-tertiary">{formatExpiry(preview.expiresAt)}</p>
              </div>

              {preview.canRespondAfterLogin ? (
                <div className="space-y-2">
                  <Button type="button" className="w-full" onClick={onLogin}>
                    登录后处理邀请
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={onRegister}>
                    注册新账号
                  </Button>
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-xs text-text-muted">
                  {statusText(preview.status)}，该邀请已不能继续处理。
                </p>
              )}
            </div>
          )}
        </section>

        <p className="px-2 text-center text-[11px] text-text-tertiary">
          登录后会回到本页继续处理邀请，不会丢失邀请链接。
        </p>
      </div>
    </SecondaryLayout>
  );
}

export function MyInvitationsView({
  state,
  items,
  errorMessage,
  onRetry,
  tokenState,
  tokenDetail,
  tokenError,
  onTokenRetry,
  onRespond,
  pendingInvitationId,
  onGoProfile,
  onGoLedger,
}: MyInvitationsViewProps): React.JSX.Element {
  const submitting = pendingInvitationId !== null;

  return (
    <SecondaryLayout title="我的邀请" fallbackBackUrl="/user/profile">
      <div className="mx-auto max-w-md space-y-6 px-4 py-4">
        {tokenState !== 'idle' && (
          <section className="rounded-2xl border border-app-border bg-app-card p-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
              <MailCheck className="size-5 text-primary" aria-hidden="true" />
              <span>邀请链接</span>
            </div>

            {tokenState === 'loading' && (
              <div className="mt-4 space-y-2" aria-label="正在加载邀请">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            )}

            {tokenState === 'error' && (
              <div className="mt-3 space-y-3">
                <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700" role="alert">
                  {tokenError ?? '邀请链接无效或不可用'}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onTokenRetry}>
                  重新加载
                </Button>
              </div>
            )}

            {tokenState === 'ready' && tokenDetail && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-main">
                    {tokenDetail.ledger?.name ?? tokenDetail.ledgerId}
                  </span>
                  {tokenDetail.ledger?.type && <LedgerBadge type={tokenDetail.ledger.type} />}
                  <LedgerBadge role={tokenDetail.role} />
                </div>
                <p className="text-xs text-text-muted">
                  {inviterName(tokenDetail)} 邀请你以 {tokenDetail.role === 'EDITOR' ? '记账协作' : '只读观察'} 身份加入，{formatExpiry(tokenDetail.expiresAt)}。
                </p>

                {tokenDetail.blockedReason === 'EMAIL_REQUIRED' && (
                  <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    <p>当前账号还没有填写邮箱。补全邮箱后即可响应这条邀请。</p>
                    <Button type="button" size="sm" onClick={onGoProfile}>
                      去补全邮箱
                    </Button>
                  </div>
                )}

                {tokenDetail.blockedReason === 'EMAIL_MISMATCH' && (
                  <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    <p>
                      邀请发送至 {tokenDetail.targetEmailMasked}，当前账号邮箱不匹配。更换为匹配邮箱后可继续。
                    </p>
                    <Button type="button" size="sm" onClick={onGoProfile}>
                      去修改邮箱
                    </Button>
                  </div>
                )}

                {tokenDetail.blockedReason === 'ALREADY_MEMBER' && (
                  <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                    <p className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      你已经是该账本的成员。
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onGoLedger(tokenDetail.ledgerId)}
                    >
                      进入账本
                    </Button>
                  </div>
                )}

                {tokenDetail.blockedReason &&
                  !['EMAIL_REQUIRED', 'EMAIL_MISMATCH', 'ALREADY_MEMBER'].includes(
                    tokenDetail.blockedReason,
                  ) && (
                    <p className="rounded-xl bg-slate-50 p-3 text-xs text-text-muted">
                      {statusText(tokenDetail.status)}，不能继续加入。
                    </p>
                  )}

                {tokenDetail.canAccept && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      isLoading={pendingInvitationId === tokenDetail.id}
                      onClick={() => onRespond(tokenDetail.id, 'accept')}
                    >
                      接受邀请
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={submitting}
                      onClick={() => onRespond(tokenDetail.id, 'decline')}
                    >
                      拒绝
                    </Button>
                  </div>
                )}

                {!tokenDetail.canAccept && tokenDetail.canDecline && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={submitting}
                    onClick={() => onRespond(tokenDetail.id, 'decline')}
                  >
                    拒绝此邀请
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            待处理的账本邀请 ({items.length})
          </h2>

          {state === 'loading' && (
            <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border bg-app-card">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              ))}
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3 rounded-2xl border border-app-border bg-app-card p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-rose-600">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage ?? '加载邀请列表失败'}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                重试
              </Button>
            </div>
          )}

          {state === 'empty' && (
            <div className="rounded-2xl border border-app-border bg-app-card p-8 text-center text-sm text-text-muted">
              暂无待处理邀请
            </div>
          )}

          {state === 'ready' && (
            <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border bg-app-card">
              {items.map((item) => (
                <div key={item.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-main">{item.ledgerName}</span>
                      <LedgerBadge type={item.ledgerType} />
                    </div>
                    <LedgerBadge role={item.role} />
                  </div>
                  <p className="text-xs text-text-tertiary">
                    {item.inviterName} 邀请 · {formatExpiry(item.expiresAt)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting}
                      isLoading={pendingInvitationId === item.id}
                      onClick={() => onRespond(item.id, 'accept')}
                    >
                      接受
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => onRespond(item.id, 'decline')}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!tokenState && (
          <div className="flex items-start gap-2 rounded-2xl border border-app-border bg-app-card p-4 text-xs text-text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
            <span>收到邀请链接时，登录后会自动回到这里处理；也可以在上方列表中直接接受或拒绝。</span>
          </div>
        )}
      </div>
    </SecondaryLayout>
  );
}
