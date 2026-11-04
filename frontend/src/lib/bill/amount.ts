/**
 * 金额文本与整数分的互转。
 *
 * 全部走字符串处理：`parseFloat(text) * 100` 在 0.1+0.2 一类输入上会产生
 * 1.9999999 这样的中间值，四舍五入后可能偏离用户实际输入。
 */

export interface AmountParseResult {
  cents: number | null;
  error: string | null;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** 把键盘输入解析为整数分；非法输入返回 `{ cents: null, error }`。 */
export function parseAmountText(text: string): AmountParseResult {
  const trimmed = text.trim();

  if (trimmed === '' || trimmed === '0' || trimmed === '0.') {
    return { cents: null, error: '请输入金额' };
  }

  if (!AMOUNT_PATTERN.test(trimmed)) {
    return { cents: null, error: '金额最多支持两位小数' };
  }

  const [integerPart, decimalPart = ''] = trimmed.split('.');
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));

  if (!Number.isInteger(cents) || cents <= 0) {
    return { cents: null, error: '请输入大于 0 的金额' };
  }

  return { cents, error: null };
}

/** 把整数分回填为可编辑文本，如 1250 → "12.50"。 */
export function amountTextFromCents(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '0';
  const integerPart = Math.floor(cents / 100);
  const decimalPart = cents % 100;
  return `${integerPart}.${decimalPart.toString().padStart(2, '0')}`;
}

/** 键盘按键的语义标识：数字、小数点、退格、清空。 */
export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'BACKSPACE' | 'CLEAR';

/** 金额输入的长度上限（含小数点），避免撑破显示区。 */
export const AMOUNT_MAX_LENGTH = 10;

/**
 * 把一次按键应用到当前金额文本上，返回下一个文本。
 *
 * 纯函数是必须的：调用方在同一个渲染批次里连点多次时，只能拿这份结果往下推，
 * 不能依赖 React 已经提交的 state，否则中间的按键会被互相覆盖。
 */
export function applyAmountKey(current: string, key: AmountKey): string {
  if (key === 'CLEAR') return '0';

  if (key === 'BACKSPACE') {
    if (current.length <= 1 || current === '0') return '0';
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }

  if (current === '0') return key;

  // 小数最多两位
  const parts = current.split('.');
  if (parts.length === 2 && parts[1].length >= 2) return current;

  if (current.length >= AMOUNT_MAX_LENGTH) return current;

  return `${current}${key}`;
}
