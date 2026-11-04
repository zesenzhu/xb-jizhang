'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SheetTypeSegmentProps {
  value: 'EXPENSE' | 'INCOME';
  onChange: (next: 'EXPENSE' | 'INCOME') => void;
}

const OPTIONS = [
  { key: 'EXPENSE', label: '支出' },
  { key: 'INCOME', label: '收入' },
] as const;

/**
 * 支出/收入分段器。
 *
 * 只负责分段本身，不带账本名等右侧信息：把它放进 `1fr` 网格列并加
 * `justify-self-center`，才能相对整行真正居中，而不是被两侧内容推偏。
 */
export function SheetTypeSegment({ value, onChange }: SheetTypeSegmentProps): React.JSX.Element {
  return (
    <div className="flex justify-self-center rounded-full bg-app-card-subtle p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={cn(
            'rounded-full px-5 py-1.5 text-xs font-semibold transition-colors',
            value === option.key
              ? 'bg-app-card text-text-main shadow-xs'
              : 'text-text-muted hover:text-text-main',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
