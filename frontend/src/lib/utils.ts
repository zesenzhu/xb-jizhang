export type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: string]: boolean | number | string | null | undefined }
  | ClassValue[];

/**
 * 类似 clsx 的轻量类名合并函数，处理条件类名与数组
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * 金额格式化选项
 */
export interface FormatCentsOptions {
  /** 是否对正数显示 '+' 号 */
  showSign?: boolean;
  /** 是否使用千分符分割整数部分，默认 true */
  useGrouping?: boolean;
}

/**
 * 将金额（整数分）格式化为带有两位小数的标准元字符串
 * 严禁使用简单浮点数除法（如 amount / 100），避免 1.9999999 精度异常
 *
 * @param cents 金额（单位：分，可为负数）
 * @param options 格式化选项
 * @returns 格式化后的元字符串，如 "12.50", "+1,234.00", "-0.05"
 */
export function formatCentsToYuan(cents: number, options: FormatCentsOptions = {}): string {
  if (!Number.isFinite(cents)) {
    return '0.00';
  }

  const { showSign = false, useGrouping = true } = options;
  const isNegative = cents < 0;
  const absoluteCents = Math.abs(Math.round(cents));

  const integerPart = Math.floor(absoluteCents / 100);
  const decimalPart = absoluteCents % 100;

  let integerStr = integerPart.toString();
  if (useGrouping) {
    integerStr = integerStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const decimalStr = decimalPart.toString().padStart(2, '0');
  const formattedAbsolute = `${integerStr}.${decimalStr}`;

  if (isNegative) {
    return `-${formattedAbsolute}`;
  }

  if (showSign && cents > 0) {
    return `+${formattedAbsolute}`;
  }

  return formattedAbsolute;
}

