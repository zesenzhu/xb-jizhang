import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';

export interface AmountDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 金额数值，单位：整数分 */
  amount: number;
  /** 货币符号，默认为 '¥' */
  currency?: string;
  /** 交易类型，影响正负符号与颜色展示 */
  type?: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'NEUTRAL';
  /** 是否显式展示正号 '+'（负数始终展示 '-'） */
  showSign?: boolean;
  /** 颜色语义：'colored' 会对收入着鲜活绿，支出着玫瑰红；'neutral' 为继承外层颜色 */
  colorSemantic?: 'colored' | 'neutral';
  /** 字号 */
  size?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
}

export function AmountDisplay({
  amount,
  currency = '¥',
  type = 'NEUTRAL',
  showSign = false,
  colorSemantic = 'neutral',
  size = 'base',
  className,
  ...props
}: AmountDisplayProps): React.JSX.Element {
  const shouldShowPlus = showSign || type === 'INCOME';
  const formattedNumber = formatCentsToYuan(amount, { showSign: shouldShowPlus });

  const sizeStyles = {
    sm: 'text-xs',
    base: 'text-sm font-medium',
    lg: 'text-base font-semibold',
    xl: 'text-xl font-bold tracking-tight',
    '2xl': 'text-2xl font-extrabold tracking-tight',
    '3xl': 'text-3xl font-black tracking-tight',
  };

  let colorStyle = '';
  if (colorSemantic === 'colored') {
    if (type === 'INCOME' || (type === 'NEUTRAL' && amount > 0)) {
      colorStyle = 'text-emerald-400';
    } else if (type === 'EXPENSE' || (type === 'NEUTRAL' && amount < 0)) {
      colorStyle = 'text-rose-400';
    } else {
      colorStyle = 'text-text-muted';
    }
  }

  return (
    <span
      className={cn('inline-flex items-baseline font-mono tabular-nums text-current', sizeStyles[size], colorStyle, className)}
      {...props}
    >
      {currency && <span className="mr-0.5 text-[0.8em] font-sans font-normal opacity-80">{currency}</span>}
      <span>{formattedNumber}</span>
    </span>
  );
}
