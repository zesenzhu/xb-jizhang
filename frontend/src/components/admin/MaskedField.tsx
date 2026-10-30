'use client';

import * as React from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MaskedFieldProps {
  /** 真实明文字符串（若已获得授权） */
  realValue?: string;
  /** 脱敏遮罩占位字符串，如 "138****0000" 或 "******" */
  maskedValue: string;
  /** 是否已被授权查看明细 */
  isRevealed?: boolean;
  /** 点击申请查看/切换明细事件 */
  onToggleReveal?: () => void;
  /** 是否处于加载中（如异步向后端申请审计 Token） */
  isLoading?: boolean;
  className?: string;
}

export function MaskedField({
  realValue,
  maskedValue,
  isRevealed = false,
  onToggleReveal,
  isLoading = false,
  className,
}: MaskedFieldProps): React.JSX.Element {
  const displayValue = isRevealed && realValue ? realValue : maskedValue;

  return (
    <div className={cn('inline-flex items-center gap-1.5 font-mono text-sm text-slate-800', className)}>
      <span className={cn('select-all', !isRevealed && 'tracking-wider text-slate-500')}>
        {displayValue}
      </span>

      {onToggleReveal && (
        <button
          type="button"
          onClick={onToggleReveal}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-50"
          title={isRevealed ? '收起敏感数据' : '申请查看明细（将记录安全审计）'}
          aria-label={isRevealed ? '隐藏明细' : '查看明细'}
        >
          {isRevealed ? (
            <EyeOff size={14} aria-hidden="true" />
          ) : (
            <div className="flex items-center gap-0.5">
              <Eye size={14} aria-hidden="true" />
              <Lock size={10} className="text-amber-500" aria-hidden="true" />
            </div>
          )}
        </button>
      )}
    </div>
  );
}

