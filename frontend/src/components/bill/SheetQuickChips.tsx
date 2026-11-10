'use client';

import * as React from 'react';
import { ImagePlus, UserRound, WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SheetQuickChipsProps {
  accountName: string | null;
  onOpenAccountPicker: () => void;
  payerName: string | null;
  onOpenPayerPicker: () => void;
  attachmentCount?: number;
  onOpenAttachmentPicker?: () => void;
  attachmentsDisabled?: boolean;
}

/**
 * 金额上方的快捷字段条。账户可用，其余是一期外能力，渲染为禁用态避免误触。
 * 与金额卡同处底部固定区，随键盘一起贴底，不参与分类区滚动。
 */
export function SheetQuickChips({
  accountName,
  onOpenAccountPicker,
  payerName,
  onOpenPayerPicker,
  attachmentCount = 0,
  onOpenAttachmentPicker,
  attachmentsDisabled = false,
}: SheetQuickChipsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none]">
      {payerName !== null && (
        <button
          type="button"
          onClick={onOpenPayerPicker}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors active:scale-95',
            payerName === '选择付款人'
              ? 'border-app-border bg-app-card-subtle text-text-muted'
              : 'border-primary/40 bg-primary/10 text-primary',
          )}
        >
          <UserRound size={12} />
          {payerName}
        </button>
      )}
      <button
        type="button"
        onClick={onOpenAccountPicker}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors active:scale-95',
          accountName
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-app-border bg-app-card-subtle text-text-muted',
        )}
      >
        <WalletCards size={12} />
        {accountName ?? '选择账户'}
      </button>

      {['报销', '优惠', '标签'].map((label) => (
        <span
          key={label}
          title="即将上线"
          className="shrink-0 rounded-full border border-app-border bg-app-card-subtle px-2.5 py-1 text-[11px] text-text-tertiary opacity-60"
        >
          {label}
        </span>
      ))}
      <button
        type="button"
        onClick={onOpenAttachmentPicker}
        disabled={attachmentsDisabled || !onOpenAttachmentPicker}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
          attachmentCount > 0
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-app-border bg-app-card-subtle text-text-muted',
        )}
      >
        <ImagePlus size={12} />
        图片{attachmentCount > 0 ? ` ${attachmentCount}` : ''}
      </button>
    </div>
  );
}
