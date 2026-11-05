'use client';

import * as React from 'react';
import { BottomSheet, SHEET_BODY_SCROLL, SHEET_FOOTER } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EditLedgerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { name: string; timezone: string; type: string; defaultCurrency: string; memberRole: string };
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (v: { name: string; timezone: string }) => void;
}

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'UTC',
  'Europe/London',
  'America/New_York',
];

export function EditLedgerSheet({
  open,
  onOpenChange,
  initial,
  isSubmitting,
  error,
  onSubmit,
}: EditLedgerSheetProps): React.JSX.Element {
  const [name, setName] = React.useState(initial.name);
  const [timezone, setTimezone] = React.useState(initial.timezone);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const [wasOpen, setWasOpen] = React.useState(open);

  // 面板打开时初始化。渲染期比较而不是 effect：避免首帧显示上一次编辑的值。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(initial.name);
      setTimezone(initial.timezone);
      setShowConfirm(false);
    }
  }

  const tzChanged = timezone !== initial.timezone;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (tzChanged && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    onSubmit({ name: name.trim(), timezone });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="编辑账本"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className={SHEET_BODY_SCROLL}>
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted block">账本名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting} maxLength={50} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted block">类型</label>
            <div className="h-10 w-full rounded-xl border border-app-border bg-app-card-subtle px-3 py-2 text-sm text-text-muted cursor-not-allowed">
              {initial.type === 'PERSONAL' ? '个人账本' : '共享账本'}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted block">时区</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl border border-app-border bg-app-card px-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {[...new Set([...TIMEZONES, timezone])].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        {showConfirm && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
            <p className="text-xs text-amber-900 leading-relaxed">
              修改时区会改变统计的自然日/月/年分组边界，账单原始时间不变。确定继续？
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>返回修改</Button>
              <Button type="submit" variant="destructive" className="flex-1" isLoading={isSubmitting}>确认保存</Button>
            </div>
          </div>
        )}
        </div>

        {!showConfirm && (
          <div className={SHEET_FOOTER}>
            <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={name.trim().length === 0}>
              保存修改
            </Button>
          </div>
        )}
      </form>
    </BottomSheet>
  );
}
