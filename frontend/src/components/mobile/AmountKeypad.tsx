'use client';

import * as React from 'react';
import { Check, Delete, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyAmountKey, type AmountKey } from '@/lib/bill/amount';

export interface AmountKeypadProps {
  /** 当前输入的金额字符串（如 "12.5"） */
  value: string;
  /** 输入发生变化回调 */
  onChange: (nextValue: string) => void;
  /** 点击确定/保存回调 */
  onSubmit?: () => void;
  /** 副提交（保存并继续）回调；不传时副键位不渲染 */
  onSecondarySubmit?: () => void;
  /** 提交按钮文案，默认为“完成” */
  submitText?: string;
  /** 副提交按钮文案，默认为“保存再记” */
  secondarySubmitText?: string;
  /** 提交是否处于 loading */
  isSubmitting?: boolean;
  /** 校验未通过时禁用两个提交键（金额为 0、时间为未来等） */
  submitDisabled?: boolean;
  /** 是否由键盘自己处理底部安全区；放在抽屉内时传 false，避免与面板内边距叠加 */
  insetSafeArea?: boolean;
  /** 紧凑模式：减低按键高度与间距，给分类区让出高度 */
  compact?: boolean;
  className?: string;
}

export function AmountKeypad({
  value,
  onChange,
  onSubmit,
  onSecondarySubmit,
  submitText = '完成',
  secondarySubmitText = '保存再记',
  isSubmitting = false,
  submitDisabled = false,
  insetSafeArea = true,
  compact = false,
  className,
}: AmountKeypadProps): React.JSX.Element {
  // 触发微触感振动反馈（如果移动端浏览器支持）
  const triggerHaptic = (): void => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // 忽略不支持或策略拦截
      }
    }
  };

  /**
   * 按键统一走 `applyAmountKey` 纯函数。
   *
   * 之前用本帧的 `value` 闭包计算：同一渲染批次里的连续点击拿到的都是同一个旧值，
   * 后一次会覆盖前一次，连点 `888` 只剩一个 8。现在改为功能式累积 ——
   * 每次点击都把结果推入 pending，渲染提交前再次点击也能接上。
   */
  const pendingRef = React.useRef<string | null>(null);

  const handleKeyPress = (key: AmountKey): void => {
    triggerHaptic();
    const base = pendingRef.current ?? value;
    const next = applyAmountKey(base, key);
    pendingRef.current = next;
    onChange(next);
  };

  // 父级确认了新值后清空 pending，避免残留一次输入覆盖后续外部重置。
  React.useEffect(() => {
    pendingRef.current = null;
  }, [value]);

  const keyBaseClass = cn(
    'flex items-center justify-center rounded-2xl bg-app-card font-medium text-text-main shadow-xs transition-all active:scale-[0.96] active:bg-app-card-subtle select-none border border-app-border/40',
    compact ? 'h-11 text-base' : 'h-14 text-xl',
  );

  const submitDisabledFinal = isSubmitting || submitDisabled;

  /**
   * 提交键必须显式撑满所在网格单元：此前依赖父级 flex-1 包裹，
   * 按钮自身高度塌成内容高度，「完成」会被裁切。
   */
  const submitButton = (extraClass?: string) => (
    <button
      type="button"
      disabled={submitDisabledFinal}
      onClick={() => {
        triggerHaptic();
        onSubmit?.();
      }}
      className={cn(
        'flex h-full items-center justify-center rounded-2xl bg-primary font-semibold text-white shadow-md shadow-primary/25 transition-all select-none hover:bg-primary-hover active:scale-[0.97] active:bg-primary-active disabled:opacity-50',
        compact ? 'text-[13px]' : 'text-base',
        extraClass,
      )}
    >
      <span className="flex items-center gap-1 leading-none">
        <Check size={compact ? 16 : 20} strokeWidth={2.8} />
        <span>{isSubmitting ? '保存中' : submitText}</span>
      </span>
    </button>
  );

  return (
    <div
      className={cn(
        'grid grid-cols-4 rounded-3xl border border-app-border/40 bg-app-card-subtle/80',
        compact ? 'gap-1.5 p-1.5' : 'gap-2 p-3',
        insetSafeArea && 'pb-safe',
        className,
      )}
    >
      {/* 1, 2, 3, 退格 */}
      <button type="button" onClick={() => handleKeyPress('1')} className={keyBaseClass}>
        1
      </button>
      <button type="button" onClick={() => handleKeyPress('2')} className={keyBaseClass}>
        2
      </button>
      <button type="button" onClick={() => handleKeyPress('3')} className={keyBaseClass}>
        3
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress('BACKSPACE')}
        className={cn(keyBaseClass, 'bg-app-card-subtle/80 text-text-muted active:bg-app-card-subtle')}
        aria-label="退格"
      >
        <Delete size={22} />
      </button>

      {/* 4, 5, 6, 清空 */}
      <button type="button" onClick={() => handleKeyPress('4')} className={keyBaseClass}>
        4
      </button>
      <button type="button" onClick={() => handleKeyPress('5')} className={keyBaseClass}>
        5
      </button>
      <button type="button" onClick={() => handleKeyPress('6')} className={keyBaseClass}>
        6
      </button>
      <button
        type="button"
        onClick={() => handleKeyPress('CLEAR')}
        className={cn(keyBaseClass, 'bg-app-card-subtle/80 text-text-muted active:bg-app-card-subtle text-sm font-semibold')}
        aria-label="清空"
      >
        <RotateCcw size={18} />
      </button>

      {/* 7, 8, 9, 提交（含副提交槽位） */}
      <button type="button" onClick={() => handleKeyPress('7')} className={keyBaseClass}>
        7
      </button>
      <button type="button" onClick={() => handleKeyPress('8')} className={keyBaseClass}>
        8
      </button>
      <button type="button" onClick={() => handleKeyPress('9')} className={keyBaseClass}>
        9
      </button>

      {onSecondarySubmit ? (
        // 两行等分：副键在上、主键在下，两个键都撑满各自的网格单元。
        <div className="row-span-2 grid grid-rows-2 gap-1.5">
          <button
            type="button"
            disabled={submitDisabledFinal}
            onClick={() => {
              triggerHaptic();
              onSecondarySubmit();
            }}
            className="flex h-full items-center justify-center rounded-2xl bg-app-card-subtle text-xs font-semibold text-text-main transition-all active:scale-[0.97] disabled:opacity-50"
          >
            {secondarySubmitText}
          </button>
          {submitButton()}
        </div>
      ) : (
        submitButton('row-span-2')
      )}

      {/* 0, 小数点 */}
      <button
        type="button"
        onClick={() => handleKeyPress('0')}
        className={cn(keyBaseClass, 'col-span-2')}
      >
        0
      </button>
      <button type="button" onClick={() => handleKeyPress('.')} className={keyBaseClass}>
        .
      </button>
    </div>
  );
}
