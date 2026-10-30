import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      isLoading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variantStyles = {
      default: 'bg-ios-blue text-white shadow-xs hover:bg-ios-blue-hover active:bg-ios-blue-active',
      destructive: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800',
      outline:
        'border border-slate-200 bg-white shadow-xs hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 text-slate-700',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
      ghost: 'hover:bg-slate-100 hover:text-slate-900 text-slate-700 active:bg-slate-200',
      link: 'text-ios-blue underline-offset-4 hover:underline p-0 h-auto active:scale-100',
    };

    const sizeStyles = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 rounded-lg px-3 text-xs',
      lg: 'h-12 rounded-2xl px-6 text-base',
      icon: 'size-10 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="size-4 animate-spin text-current" aria-hidden="true" />}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  },
);

Button.displayName = 'Button';
