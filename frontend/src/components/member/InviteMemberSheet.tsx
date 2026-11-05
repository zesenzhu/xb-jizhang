'use client';

import * as React from 'react';
import { BottomSheet, SHEET_BODY_SCROLL, SHEET_FOOTER } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, Copy, Mail } from 'lucide-react';

export interface InviteMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  error: string | null;
  result: {
    targetEmail: string;
    role: 'EDITOR' | 'VIEWER';
    expiresAt: string;
    inviteLink: string;
  } | null;
  onSubmit: (input: { targetEmail: string; role: 'EDITOR' | 'VIEWER' }) => void;
}

export function InviteMemberSheet({
  open,
  onOpenChange,
  isSubmitting,
  error,
  result,
  onSubmit,
}: InviteMemberSheetProps): React.JSX.Element {
  const [role, setRole] = React.useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [email, setEmail] = React.useState('');
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  const [wasOpen, setWasOpen] = React.useState(open);

  // 重新打开时清掉上次的复制提示；渲染期比较避免多一次渲染。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setCopyStatus('idle');
  }

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={result ? '邀请创建成功' : '邀请成员'}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={SHEET_BODY_SCROLL}>
        {result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-app-border bg-app-card p-4 space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-text-muted">受邀邮箱</div>
                <div className="text-sm text-text-main">{result.targetEmail}</div>
              </div>
              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <div className="text-xs text-text-muted">授予角色</div>
                  <div className="text-sm text-text-main">{result.role === 'EDITOR' ? '记账协作' : '只读观察'}</div>
                </div>
                <div className="space-y-1 flex-1">
                  <div className="text-xs text-text-muted">到期时间</div>
                  <div className="text-sm text-text-main">{new Date(result.expiresAt).toLocaleDateString('zh-CN')}</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-text-muted font-medium">邀请链接</div>
              <Input value={result.inviteLink} readOnly endIcon={<Copy size={16} />} />
              {copyStatus === 'error' && (
                <p className="text-xs text-rose-600">复制失败，请手动选择链接</p>
              )}
            </div>
          </div>
        ) : (
          <form
            id="invite-member-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit({ targetEmail: email, role });
            }}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 flex items-center gap-2" role="alert">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">受邀成员邮箱</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入成员邮箱"
                required
                startIcon={<Mail size={16} />}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-main">授予角色</label>
              <div className="grid grid-cols-2 gap-2">
                <RoleOption
                  label="记账协作"
                  description="可新增/修改账单"
                  checked={role === 'EDITOR'}
                  onChange={() => setRole('EDITOR')}
                />
                <RoleOption
                  label="只读观察"
                  description="仅可查看报表"
                  checked={role === 'VIEWER'}
                  onChange={() => setRole('VIEWER')}
                />
              </div>
            </div>
          </form>
        )}
        </div>

        <div className={SHEET_FOOTER}>
          {result ? (
            <Button
              className="w-full"
              onClick={() => {
                if (copyStatus !== 'success') handleCopy(result.inviteLink);
                onOpenChange(false);
              }}
            >
              {copyStatus === 'success' ? <><Check size={16} /> 已复制</> : '复制链接并完成'}
            </Button>
          ) : (
            <Button
              type="submit"
              form="invite-member-form"
              className="w-full"
              isLoading={isSubmitting}
            >
              发起邀请
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function RoleOption({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'p-3 rounded-xl border text-left transition-all',
        checked
          ? 'border-primary bg-primary-subtle'
          : 'border-app-border bg-app-card hover:bg-app-card-subtle'
      )}
    >
      <div className={cn('text-sm font-medium', checked ? 'text-primary' : 'text-text-main')}>{label}</div>
      <div className="text-xs text-text-tertiary">{description}</div>
    </button>
  );
}
