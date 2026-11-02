import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, startIcon, endIcon, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {startIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-text-tertiary">
              {startIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            disabled={disabled}
            className={cn(
              'flex h-10 w-full rounded-xl border border-app-border bg-app-card px-3 py-2 text-sm text-text-main placeholder:text-text-muted transition-colors',
              'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
              'disabled:cursor-not-allowed disabled:bg-app-card-subtle disabled:text-text-muted',
              startIcon && 'pl-9',
              endIcon && 'pr-9',
              error && 'border-rose-500 focus-visible:border-rose-500 focus-visible:ring-rose-500/20',
              className,
            )}
            {...props}
          />
          {endIcon && (
            <div className="pointer-events-none absolute right-3 flex items-center text-text-tertiary">
              {endIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
