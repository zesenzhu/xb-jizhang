import type { TransactionSummary } from '@/lib/api/transaction-types';
import { LEDGER_TIME_ZONE, billDateOf } from './timezone';

export interface BillDayGroup {
  /** 账本时区下的账单日 YYYY-MM-DD */
  billDate: string;
  /** MM/DD，跨年时带年份 */
  label: string;
  /** 星期一 / 星期二 … */
  weekday: string;
  isToday: boolean;
  isYesterday: boolean;
  expenseCents: number;
  incomeCents: number;
  items: TransactionSummary[];
}

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 按账本时区把账单分组成日期卡片。
 *
 * 分组依据是 `billDateOf`，不是设备时区：跨时区用户打开同一账本必须看到相同的日期归属。
 * 组内按发生时间倒序，组间按日期倒序。
 */
export function groupBillsByDay(
  items: readonly TransactionSummary[],
  options: { timeZone?: string; now?: Date } = {},
): BillDayGroup[] {
  const timeZone = options.timeZone ?? LEDGER_TIME_ZONE;
  const now = options.now ?? new Date();
  const today = billDateOf(now.toISOString(), timeZone);
  const yesterday = billDateOf(new Date(now.getTime() - 86_400_000).toISOString(), timeZone);

  const buckets = new Map<string, TransactionSummary[]>();
  for (const item of items) {
    const billDate = billDateOf(item.occurredAt, timeZone);
    if (!billDate) continue;
    const bucket = buckets.get(billDate);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(billDate, [item]);
    }
  }

  const groups: BillDayGroup[] = [];
  for (const [billDate, bills] of buckets) {
    bills.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

    let expenseCents = 0;
    let incomeCents = 0;
    for (const bill of bills) {
      if (bill.type === 'EXPENSE') expenseCents += bill.amountCents;
      else incomeCents += bill.amountCents;
    }

    groups.push({
      billDate,
      label: formatBillDateLabel(billDate, today),
      weekday: weekdayOf(billDate),
      isToday: billDate === today,
      isYesterday: billDate === yesterday,
      expenseCents,
      incomeCents,
      items: bills,
    });
  }

  groups.sort((left, right) => right.billDate.localeCompare(left.billDate));
  return groups;
}

/** 当年只显示 MM/DD，跨年追加年份，避免跨年账单混淆。 */
function formatBillDateLabel(billDate: string, today: string): string {
  const [year, month, day] = billDate.split('-');
  const currentYear = today.split('-')[0];
  const short = `${month}/${day}`;
  return year === currentYear ? short : `${year}/${short}`;
}

/** 用 UTC 正午解析，避免 `YYYY-MM-DD` 被按本地时区解释后偏移一天。 */
function weekdayOf(billDate: string): string {
  const [year, month, day] = billDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return WEEKDAY_LABELS[date.getUTCDay()] ?? '';
}

/** 账本时区下的 HH:mm。 */
export function formatBillTime(occurredAt: string, timeZone: string = LEDGER_TIME_ZONE): string {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * 账单行的次级文案：优先展示商家/对象，其次备注；都为空时返回空串。
 * 页面在空串时不渲染占位符。
 */
export function billSecondaryText(bill: TransactionSummary): string {
  const title = bill.title?.trim();
  if (title) return title;
  return bill.note?.trim() ?? '';
}
