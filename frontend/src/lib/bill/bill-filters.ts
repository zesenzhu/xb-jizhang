import type { StatisticsQuery } from '@/lib/api/statistics-types';
import type { TransactionListQuery, TransactionType } from '@/lib/api/transaction-types';
import { billDateOf, zonedDayBoundary, zonedMonthBoundary, shiftDateString, LEDGER_TIME_ZONE } from './timezone';

/**
 * 账本页的筛选模型。
 *
 * 关键词、付款人、类型、分类、账户、时间范围合成**一份**状态：
 * 列表与概览必须用同一组条件请求，否则会出现「概览数字与列表对不上」。
 * 时间范围保存 UTC 半开区间（`from` 含、`to` 不含），与统计接口的 `startAt/endAt` 口径一致。
 */
export type BillFilterType = '' | TransactionType;

/** 条件胶囊的键；分类与时间范围各自是一个胶囊，但内部清两个字段。 */
export type BillFilterChipKey =
  | 'keyword'
  | 'payerId'
  | 'createdById'
  | 'type'
  | 'category'
  | 'accountId'
  | 'range';

export interface BillFilter {
  keyword: string;
  payerId: string;
  createdById: string;
  type: BillFilterType;
  categoryRootId: string;
  categoryId: string;
  uncategorized?: boolean;
  accountId: string;
  /** UTC ISO，左闭 */
  from: string;
  /** UTC ISO，右开 */
  to: string;
}

export interface BillFilterMember {
  id: string;
  name: string;
}

export interface BillFilterCategory {
  id: string;
  name: string;
  parentId: string | null;
  type: TransactionType;
}

export interface BillFilterAccount {
  id: string;
  name: string;
}

/** 反查展示文案用的字典；缺失时降级为「已选分类」等占位，不抛错。 */
export interface BillFilterLabels {
  members?: readonly BillFilterMember[];
  categories?: readonly BillFilterCategory[];
  accounts?: readonly BillFilterAccount[];
  timeZone?: string;
}

export interface BillFilterChip {
  key: BillFilterChipKey;
  label: string;
}

/** 概览接口接受的筛选项；分类两字段互斥，故写成可选而非 Pick。 */
export interface StatisticsFilterQuery {
  keyword?: string;
  payerId?: string;
  createdById?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  categoryRootId?: string;
  uncategorized?: boolean;
}

export interface BillFilterMonth {
  year: number;
  /** 1-12 */
  month: number;
}

/** 月份导航与自定义范围合成的一次查询上下文。 */
export interface BillScope {
  from: string;
  to: string;
  isCustomRange: boolean;
  /** 例 `2026-11-01 至 2026-11-07`；无自定义范围时为 null */
  rangeLabel: string | null;
  /** 直接交给二期统计接口的时间参数（不含任何筛选） */
  statistics: StatisticsQuery;
}

export function createInitialBillFilter(): BillFilter {
  return {
    keyword: '',
    payerId: '',
    createdById: '',
    type: '',
    categoryRootId: '',
    categoryId: '',
    accountId: '',
    from: '',
    to: '',
  };
}

export function submitBillKeyword(filter: BillFilter, keyword: string): BillFilter {
  return { ...filter, keyword: keyword.trim() };
}

export function clearBillFilter(_filter: BillFilter): BillFilter {
  return createInitialBillFilter();
}

/**
 * 移除单个条件。
 *
 * 分类与时间范围在界面上各是一个胶囊，但分别对应两个后端参数，
 * 所以移除时要成对清空；只清一半会让列表继续被旧条件过滤。
 */
export function removeBillFilter(filter: BillFilter, key: BillFilterChipKey): BillFilter {
  if (key === 'category') {
    const next = {
      ...filter,
      categoryRootId: '',
      categoryId: '',
    };
    delete next.uncategorized;
    return next;
  }
  if (key === 'range') return { ...filter, from: '', to: '' };
  return { ...filter, [key]: '' };
}

export function isBillFilterActive(filter: BillFilter): boolean {
  return Boolean(
    filter.keyword ||
      filter.payerId ||
      filter.createdById ||
      filter.type ||
      filter.categoryRootId ||
      filter.categoryId ||
      filter.uncategorized ||
      filter.accountId ||
      filter.from ||
      filter.to,
  );
}

export function hasRangeFilter(filter: BillFilter): boolean {
  return Boolean(filter.from && filter.to);
}

/**
 * 转成账单列表的查询参数。
 *
 * `categoryId` 与 `categoryRootId` 在服务端互斥，这里按同一优先级择一发送：
 * 精确分类优先（二级分类下钻），否则发一级分类。
 */
export function toBillFilterQuery(
  filter: BillFilter,
): Pick<
  TransactionListQuery,
  | 'keyword'
  | 'payerId'
  | 'createdById'
  | 'type'
  | 'categoryId'
  | 'categoryRootId'
  | 'uncategorized'
  | 'accountId'
  | 'from'
  | 'to'
> {
  return {
    ...(filter.keyword ? { keyword: filter.keyword } : {}),
    ...(filter.payerId ? { payerId: filter.payerId } : {}),
    ...(filter.createdById ? { createdById: filter.createdById } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.uncategorized && !filter.categoryId && !filter.categoryRootId
      ? { uncategorized: true }
      : filter.categoryId
        ? { categoryId: filter.categoryId }
        : filter.categoryRootId
          ? { categoryRootId: filter.categoryRootId }
          : {}),
    ...(filter.accountId ? { accountId: filter.accountId } : {}),
    ...(filter.from ? { from: filter.from } : {}),
    ...(filter.to ? { to: filter.to } : {}),
  };
}

/**
 * 统计接口的筛选项：与列表同源，但**不含** `from`/`to`。
 *
 * 概览的时间边界由 `period`/`anchorDate`/`fromDate`/`toDate` 表达，
 * 多传 ISO 边界会被 DTO 当作非法组合拒绝。
 */
export function toStatisticsFilterQuery(filter: BillFilter): StatisticsFilterQuery {
  return {
    ...(filter.keyword ? { keyword: filter.keyword } : {}),
    ...(filter.payerId ? { payerId: filter.payerId } : {}),
    ...(filter.createdById ? { createdById: filter.createdById } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.accountId ? { accountId: filter.accountId } : {}),
    ...(filter.uncategorized && !filter.categoryId && !filter.categoryRootId
      ? { uncategorized: true }
      : filter.categoryId
        ? { categoryId: filter.categoryId }
        : filter.categoryRootId
          ? { categoryRootId: filter.categoryRootId }
          : {}),
  };
}

/** 自定义范围换算成账本时区下的本地日期；无范围时两端都是空串。 */
export function billFilterDates(
  filter: BillFilter,
  timeZone: string = LEDGER_TIME_ZONE,
): { fromDate: string; toDate: string } {
  if (!hasRangeFilter(filter)) return { fromDate: '', toDate: '' };
  const endMs = new Date(filter.to).getTime();
  return {
    fromDate: billDateOf(filter.from, timeZone),
    toDate: Number.isNaN(endMs)
      ? ''
      : billDateOf(new Date(endMs - 1).toISOString(), timeZone),
  };
}

/**
 * 把筛选面板里的本地日期写回筛选条件。
 *
 * 面板收集的是「账本时区的自然日」，接口要的是 UTC 半开区间：
 * 起始日取当日 00:00，结束日取次日 00:00（`endAt` 严格不包含）。
 * 只填一端时保持原值不动——面板已禁用提交，这里只是兜底。
 */
export function withBillFilterDates(
  filter: BillFilter,
  dates: { fromDate: string; toDate: string },
  timeZone: string = LEDGER_TIME_ZONE,
): BillFilter {
  const { fromDate, toDate } = dates;
  if (!fromDate && !toDate) return { ...filter, from: '', to: '' };
  if (!fromDate || !toDate || fromDate > toDate) return filter;

  return {
    ...filter,
    from: zonedDayBoundary(fromDate, timeZone),
    to: zonedDayBoundary(shiftDateString(toDate, 1), timeZone),
  };
}

function fullMonthStatistics(
  fromDate: string,
  toDate: string,
  month: BillFilterMonth,
): StatisticsQuery | null {
  const monthStart = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const monthEnd = `${month.year}-${String(month.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  if (fromDate !== monthStart || toDate !== monthEnd) return null;
  return { period: 'MONTH', anchorDate: monthStart };
}

/**
 * 条件胶囊。
 *
 * 顺序固定（关键词 → 类型 → 分类 → 账户 → 付款人 → 记账人 → 时间），
 * 与面板里的分组顺序一致，避免每次增删条件时胶囊乱跳。
 */
export function getBillFilterChips(
  filter: BillFilter,
  labels: BillFilterLabels = {},
): BillFilterChip[] {
  const timeZone = labels.timeZone ?? LEDGER_TIME_ZONE;
  const chips: BillFilterChip[] = [];

  if (filter.keyword) chips.push({ key: 'keyword', label: `关键词：${filter.keyword}` });
  if (filter.type) {
    chips.push({ key: 'type', label: filter.type === 'EXPENSE' ? '类型：支出' : '类型：收入' });
  }

  if (filter.categoryId || filter.categoryRootId || filter.uncategorized) {
    chips.push({ key: 'category', label: `分类：${categoryLabel(filter, labels.categories)}` });
  }

  if (filter.accountId) {
    const account = labels.accounts?.find((item) => item.id === filter.accountId);
    chips.push({ key: 'accountId', label: `账户：${account?.name ?? '已选账户'}` });
  }

  if (filter.payerId) {
    const member = labels.members?.find((item) => item.id === filter.payerId);
    chips.push({ key: 'payerId', label: `付款人：${member?.name ?? '未知成员'}` });
  }

  if (filter.createdById) {
    const member = labels.members?.find((item) => item.id === filter.createdById);
    chips.push({ key: 'createdById', label: `记账人：${member?.name ?? '未知成员'}` });
  }

  if (hasRangeFilter(filter)) {
    const { fromDate, toDate } = billFilterDates(filter, timeZone);
    chips.push({ key: 'range', label: `时间：${fromDate} 至 ${toDate}` });
  }

  return chips;
}

function categoryLabel(
  filter: BillFilter,
  categories: readonly BillFilterCategory[] | undefined,
): string {
  if (filter.uncategorized && !filter.categoryId && !filter.categoryRootId) return '未分类';
  const exact = filter.categoryId
    ? categories?.find((item) => item.id === filter.categoryId)
    : undefined;
  if (exact) {
    const parent = exact.parentId
      ? categories?.find((item) => item.id === exact.parentId)
      : undefined;
    return parent ? `${parent.name}/${exact.name}` : exact.name;
  }

  const root = filter.categoryRootId
    ? categories?.find((item) => item.id === filter.categoryRootId)
    : undefined;
  if (root) return root.name;

  return '已选分类';
}

/**
 * 把「月份导航 + 自定义范围」解析成一次查询的完整边界。
 *
 * 两者同时存在时**以自定义范围为准**（需求 3：统计页下钻进来的 URL 范围优先），
 * 月份只在没有自定义范围时参与计算。统计接口的时间参数也在这里定：
 * 传 MONTH + anchorDate，或 RANGE + fromDate/toDate，绝不自己算 UTC 边界。
 */
export function resolveBillScope(
  filter: BillFilter,
  month: BillFilterMonth,
  timeZone: string = LEDGER_TIME_ZONE,
): BillScope {
  const { fromDate, toDate } = billFilterDates(filter, timeZone);
  if (hasRangeFilter(filter) && fromDate && toDate) {
    return {
      from: filter.from,
      to: filter.to,
      isCustomRange: true,
      rangeLabel: `${fromDate} 至 ${toDate}`,
      // 统计页当前自然月的下钻范围会覆盖到月末，月底可能还未到。
      // 用 MONTH 保留服务端允许的「当前月含未来空日期」语义，避免把它变成非法 RANGE。
      statistics:
        fullMonthStatistics(fromDate, toDate, month) ?? {
          period: 'RANGE',
          fromDate,
          toDate,
        },
    };
  }

  const nextMonth = month.month === 12 ? 1 : month.month + 1;
  const nextYear = month.month === 12 ? month.year + 1 : month.year;
  return {
    from: zonedMonthBoundary(month.year, month.month, timeZone),
    to: zonedMonthBoundary(nextYear, nextMonth, timeZone),
    isCustomRange: false,
    rangeLabel: null,
    statistics: {
      period: 'MONTH',
      anchorDate: `${month.year}-${String(month.month).padStart(2, '0')}-01`,
    },
  };
}

/**
 * 账单列表的完整查询参数。
 *
 * `from`/`to` 一律取自 scope：它们就是「当前页面的时间口径」，
 * 不允许列表和概览各算一份边界。
 */
export function toBillListQuery(
  filter: BillFilter,
  month: BillFilterMonth,
  timeZone: string,
  page: number,
  pageSize: number,
): TransactionListQuery {
  const scope = resolveBillScope(filter, month, timeZone);
  return { page, pageSize, ...toBillFilterQuery(filter), from: scope.from, to: scope.to };
}
