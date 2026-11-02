import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={cn('animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/10', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

