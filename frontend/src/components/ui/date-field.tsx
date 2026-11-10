import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DateFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  placeholder: string;
}

/** 用原生 date picker 负责选择，用自定义文本负责展示，避免 iOS 原生控件排版错位。 */
export function DateField({ className, placeholder, value, ...props }: DateFieldProps): React.JSX.Element {
  const hasValue = typeof value === 'string' && Boolean(value);

  return (
    <label
      className={cn(
        'relative flex h-11 min-w-0 flex-1 items-center overflow-hidden rounded-2xl border border-app-border bg-app-card px-3 text-xs outline-none transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        className,
      )}
    >
      <span
        className={cn('truncate', hasValue ? 'text-text-main' : 'text-text-muted')}
        aria-hidden="true"
      >
        {hasValue ? value : placeholder}
      </span>
      <input
        {...props}
        type="date"
        value={value}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
