import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps): React.JSX.Element {
  const baseStyles =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none';

  const variantStyles = {
    default: 'bg-slate-900 text-white',
    secondary: 'bg-slate-100 text-slate-800',
    outline: 'border border-slate-200 text-slate-700 bg-white',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    destructive: 'bg-rose-50 text-rose-700 border border-rose-200/60',
  };

  return <span className={cn(baseStyles, variantStyles[variant], className)} {...props} />;
}

