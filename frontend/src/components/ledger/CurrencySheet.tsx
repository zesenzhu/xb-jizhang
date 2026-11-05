'use client';

import * as React from 'react';
import { BottomSheet, SHEET_BODY_SCROLL, SHEET_FOOTER } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CurrencySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  editable: boolean;
  lockedReason?: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (currency: string) => void;
}

const CURRENCIES = [
  { code: 'CNY', label: '人民币 CNY' },
  { code: 'USD', label: '美元 USD' },
  { code: 'EUR', label: '欧元 EUR' },
  { code: 'JPY', label: '日元 JPY' },
  { code: 'HKD', label: '港币 HKD' },
];

export function CurrencySheet({
  open,
  onOpenChange,
  current,
  editable,
  lockedReason,
  isSubmitting,
  error,
  onSubmit,
}: CurrencySheetProps): React.JSX.Element {
  const [selected, setSelected] = React.useState(current);
  const [wasOpen, setWasOpen] = React.useState(open);

  // 每次打开都以账本当前币种为起点；渲染期比较避免先闪一帧上次的选择。
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setSelected(current);
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!editable || selected === current) return;
    onSubmit(selected);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="账本币种"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className={SHEET_BODY_SCROLL}>
          <div className="space-y-5">
            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
                {error}
              </div>
            )}

            {!editable ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-app-border bg-app-card-subtle p-3.5 space-y-1">
                  <div className="text-xs text-text-tertiary">当前结算币种</div>
                  <div className="text-base font-semibold text-text-main">
                    {CURRENCIES.find((c) => c.code === current)?.label ?? current}
                  </div>
                </div>
                {lockedReason && (
                  <p className="text-xs text-text-muted leading-relaxed">{lockedReason}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted block">选择币种</label>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-xl border border-app-border bg-app-card px-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed">
                  修改后金额输入与展示单位会改变，现有历史数据将使用新币种标识展示。
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={cn(SHEET_FOOTER, 'flex gap-3')}>
          {!editable ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              我知道了
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={isSubmitting}
                disabled={selected === current}
              >
                保存
              </Button>
            </>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
