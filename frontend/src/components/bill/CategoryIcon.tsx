import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CategoryIconProps {
  /** 分类名称；用于降级取首字 */
  name: string;
  /** 分类颜色（后端暂无，缺省时按名称哈希取色板） */
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 分类色板。后端 `transactionSelect` 暂未返回 `category.icon` / `color`，
 * 先按名称哈希稳定取色，保证同一分类在不同页面颜色一致。
 */
const PALETTE = ['#ff6b5b', '#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#9b8cf5', '#eb7ab8', '#8d9db6'];

function paletteFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

const SIZE_CLASS = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
} as const;

export function CategoryIcon({ name, color, size = 'md', className }: CategoryIconProps): React.JSX.Element {
  const background = color ?? paletteFor(name);
  const initial = name.trim().slice(0, 1) || '账';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        SIZE_CLASS[size],
        className,
      )}
      style={{ backgroundColor: background }}
    >
      {initial}
    </span>
  );
}
