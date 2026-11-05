import type { TransactionType } from '@/lib/api/transaction-types';
import { createInitialBillFilter, type BillFilter } from './bill-filters';

/**
 * 统计页 → 账本页的下钻参数。
 *
 * 时间边界直接用统计响应里的 `startAt`/`endAt`（UTC 半开区间），
 * 不在浏览器时区重算：账本时区与设备时区可能不同，重算会让金额对不上。
 */
export interface BillDrilldown {
  /** UTC ISO，左闭 */
  from: string;
  /** UTC ISO，右开 */
  to: string;
  type?: TransactionType;
  categoryRootId?: string;
  categoryId?: string;
  accountId?: string;
  payerId?: string;
  keyword?: string;
}

/** 下钻 URL 的输入；与 `BillDrilldown` 同形，但字段全部可选。 */
export interface BillDrilldownInput {
  startAt?: string | null;
  endAt?: string | null;
  type?: string | null;
  categoryRootId?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  payerId?: string | null;
  keyword?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEYWORD_MAX_LENGTH = 100;

function isIsoTimestamp(value: string): boolean {
  const time = new Date(value).getTime();
  return !Number.isNaN(time);
}

function readUuid(value: string | null): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

function readType(value: string | null): TransactionType | undefined {
  return value === 'EXPENSE' || value === 'INCOME' ? value : undefined;
}

function readKeyword(value: string | null): string | undefined {
  const keyword = value?.trim() ?? '';
  if (!keyword || keyword.length > KEYWORD_MAX_LENGTH) return undefined;
  return keyword;
}

/**
 * 解析 `/user?...` 上的下钻参数。
 *
 * 返回 null 表示「这不是一次有效下钻」，调用方按默认当月处理：
 * 参数可能被手工改坏、被旧版本链接带入，或只带了半截范围。
 * 单个字段非法（如 type 拼错）只丢该字段，不整条作废——用户仍能看到时间范围。
 */
export function parseBillDrilldown(params: {
  get(key: string): string | null;
}): BillDrilldown | null {
  const startAt = params.get('startAt');
  const endAt = params.get('endAt');
  if (!startAt || !endAt || !isIsoTimestamp(startAt) || !isIsoTimestamp(endAt)) return null;
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) return null;

  // categoryId 与 categoryRootId 在服务端互斥；精确分类信息更细，优先保留它。
  const categoryId = readUuid(params.get('categoryId'));
  const categoryRootId = categoryId ? undefined : readUuid(params.get('categoryRootId'));
  const type = readType(params.get('type'));
  const accountId = readUuid(params.get('accountId'));
  const payerId = readUuid(params.get('payerId'));
  const keyword = readKeyword(params.get('keyword'));

  return {
    from: startAt,
    to: endAt,
    ...(type ? { type } : {}),
    ...(categoryRootId ? { categoryRootId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(payerId ? { payerId } : {}),
    ...(keyword ? { keyword } : {}),
  };
}

/** 把下钻条件灌进筛选模型；除下钻字段外其余条件保持默认（空）。 */
export function toBillFilterFromDrilldown(drilldown: BillDrilldown): BillFilter {
  return {
    ...createInitialBillFilter(),
    from: drilldown.from,
    to: drilldown.to,
    keyword: drilldown.keyword ?? '',
    payerId: drilldown.payerId ?? '',
    type: drilldown.type ?? '',
    categoryRootId: drilldown.categoryRootId ?? '',
    categoryId: drilldown.categoryId ?? '',
    accountId: drilldown.accountId ?? '',
  };
}

/** 下钻 URL 的键顺序；固定顺序保证同一组条件生成同一个 URL。 */
const DRILLDOWN_KEYS = [
  'startAt',
  'endAt',
  'type',
  'categoryRootId',
  'categoryId',
  'accountId',
  'payerId',
  'keyword',
] as const;

/**
 * 拼下钻 URL。
 *
 * 缺少任一时间边界时直接返回 `/user`：只带半截范围会让账本页解析失败并退回当月，
 * 与其产生一个看起来生效、实际被忽略的链接，不如生成干净的默认地址。
 */
export function buildBillDrilldownUrl(input: BillDrilldownInput): string {
  if (!input.startAt || !input.endAt) return '/user';

  const search = new URLSearchParams();
  for (const key of DRILLDOWN_KEYS) {
    const value = input[key];
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `/user?${query}` : '/user';
}
