'use client';

import * as React from 'react';
import { WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SheetQuickChipsProps {
  accountName: string | null;
  onOpenAccountPicker: () => void;
}

/**
 * 金额上方的快捷字段条。账户可用，其余是一期外能力，渲染为禁用态避免误触。
 * 与金额卡同处底部固定区，随键盘一起贴底，不参与分类区滚动。
 */
export function SheetQuickChips({
  accountName,
  onOpenAccountPicker,
}: SheetQuickChipsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none]">
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

      {['报销', '优惠', '图片', '标签'].map((label) => (
        <span
          key={label}
          title="即将上线"
          className="shrink-0 rounded-full border border-app-border bg-app-card-subtle px-2.5 py-1 text-[11px] text-text-tertiary opacity-60"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
