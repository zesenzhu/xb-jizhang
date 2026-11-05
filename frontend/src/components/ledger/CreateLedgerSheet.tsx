'use client';

import * as React from 'react';
import { User, Users } from 'lucide-react';
import { BottomSheet, SHEET_BODY_SCROLL, SHEET_FOOTER } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LedgerType } from '@/lib/api/ledger-types';
import { cn } from '@/lib/utils';

export interface CreateLedgerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: { name: string; type: LedgerType }) => void;
  /** 面板标题；复制账本复用本表单时改为「复制账本」 */
  title?: string;
  /** 主按钮文案；默认「创建」 */
  submitText?: string;
  /** 名称输入框的初始值，复制时带源账本名 */
  initialName?: string;
}

export function CreateLedgerSheet({
  open,
  onOpenChange,
  isSubmitting,
  error,
  onSubmit,
  title = '新建账本',
  submitText = '创建',
  initialName = '',
}: CreateLedgerSheetProps): React.JSX.Element {
  const [name, setName] = React.useState(initialName);
  const [type, setType] = React.useState<LedgerType>('PERSONAL');
  const [wasOpen, setWasOpen] = React.useState(open);

  // 打开时重置表单。用渲染期比较代替 effect：effect 里 setState 会先渲染一帧旧值。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(initialName);
      setType('PERSONAL');
    }
  }

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: trimmedName, type });
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      {/*
       * 抽屉正文分两段：中部可滚动、底部按钮固定。
       * 面板本身是 overflow-hidden + max-h-[88vh]，正文必须自己承担滚动，
       * 否则内容超高时会被直接裁切；横向 px-4 与底部安全区同理不能省。
       */}
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className={cn(SHEET_BODY_SCROLL, 'space-y-5')}>
          {/* 错误提示横条 */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          {/* 账本名称输入框 */}
          <div className="space-y-1.5">
            <label
              htmlFor="create-ledger-name"
              className="block text-xs font-medium text-text-muted"
            >
              账本名称 <span className="text-rose-500">*</span>
            </label>
            <Input
              id="create-ledger-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：日常生活、旅行记账"
              maxLength={50}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* 账本类型选择 */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-text-muted">账本类型</span>
            <div className="grid grid-cols-2 gap-3">
              {/* 个人账本 */}
              <button
                type="button"
                onClick={() => setType('PERSONAL')}
                disabled={isSubmitting}
                aria-pressed={type === 'PERSONAL'}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  type === 'PERSONAL'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-app-border bg-app-card hover:border-app-border/80',
                )}
              >
                <div className="flex items-center gap-1.5 font-medium text-sm text-text-main">
                  <User className="size-4 text-primary" aria-hidden="true" />
                  <span>个人账本</span>
                </div>
                <p className="text-xs text-text-tertiary leading-relaxed">
                  仅自己可见与记账，隐私独立
                </p>
              </button>

              {/* 共享账本 */}
              <button
                type="button"
                onClick={() => setType('SHARED')}
                disabled={isSubmitting}
                aria-pressed={type === 'SHARED'}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  type === 'SHARED'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-app-border bg-app-card hover:border-app-border/80',
                )}
              >
                <div className="flex items-center gap-1.5 font-medium text-sm text-text-main">
                  <Users className="size-4 text-primary" aria-hidden="true" />
                  <span>共享账本</span>
                </div>
                <p className="text-xs text-text-tertiary leading-relaxed">
                  支持邀请家庭、伴侣或伙伴共同记账
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* 底部操作按钮：固定在面板底部，并避开 Home Indicator */}
        <div className={cn(SHEET_FOOTER, 'flex items-center gap-3')}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            取消
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!canSubmit} className="flex-1">
            {submitText}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
