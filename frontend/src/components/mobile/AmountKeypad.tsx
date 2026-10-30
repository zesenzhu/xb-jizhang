'use client';

import * as React from 'react';
import { Check, Delete, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AmountKeypadProps {
  /** 当前输入的金额字符串（如 "12.5"） */
  value: string;
  /** 输入发生变化回调 */
  onChange: (nextValue: string) => void;
  /** 点击确定/保存回调 */
  onSubmit?: () => void;
  /** 提交按钮文案，默认为“完成” */
  submitText?: string;
  /** 提交是否处于 loading */
  isSubmitting?: boolean;
  className?: string;
}

export function AmountKeypad({
  value,
  onChange,
  onSubmit,
  submitText = '完成',
  isSubmitting = false,
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

  const handleKeyPress = (key: string): void => {
    triggerHaptic();

    if (key === 'CLEAR') {
      onChange('0');
      return;
    }

    if (key === 'BACKSPACE') {
      if (value.length <= 1 || value === '0') {
        onChange('0');
      } else {
        onChange(value.slice(0, -1));
      }
      return;
    }

    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : `${value}.`);
      return;
    }

    // 处理数字键输入
    // 若当前为 "0"，直接替换为该数字（除非输入小数点）
    if (value === '0') {
      onChange(key);
      return;
    }

    // 限制小数位最多 2 位（记账金额精度：分）
    const parts = value.split('.');
    if (parts.length === 2 && parts[1].length >= 2) {
      return;
    }

    // 限制最大长度，防止溢出
    if (value.length >= 10) {
      return;
    }

    onChange(`${value}${key}`);
  };

  const keyBaseClass =
    'flex h-14 items-center justify-center rounded-2xl bg-white text-xl font-medium text-slate-800 shadow-xs transition-all active:scale-[0.96] active:bg-slate-100 select-none';

  return (
    <div className={cn('grid grid-cols-4 gap-2 rounded-3xl bg-slate-100/90 p-3 pb-safe', className)}>
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
        className={cn(keyBaseClass, 'bg-slate-200/80 text-slate-600 active:bg-slate-300')}
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
        className={cn(keyBaseClass, 'bg-slate-200/80 text-slate-600 active:bg-slate-300 text-sm font-semibold')}
        aria-label="清空"
      >
        <RotateCcw size={18} />
      </button>

      {/* 7, 8, 9, 占位/右侧确定跨行 */}
      <button type="button" onClick={() => handleKeyPress('7')} className={keyBaseClass}>
        7
      </button>
      <button type="button" onClick={() => handleKeyPress('8')} className={keyBaseClass}>
        8
      </button>
      <button type="button" onClick={() => handleKeyPress('9')} className={keyBaseClass}>
        9
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => {
          triggerHaptic();
          onSubmit?.();
        }}
        className={cn(
          'row-span-2 flex items-center justify-center rounded-2xl bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/20 active:scale-[0.97] active:bg-emerald-700 disabled:opacity-50 select-none text-base',
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <Check size={22} />
          <span>{isSubmitting ? '保存中' : submitText}</span>
        </div>
      </button>

      {/* 0 (占2列), 小数点 */}
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

