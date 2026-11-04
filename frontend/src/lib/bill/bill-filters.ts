import type { TransactionListQuery } from '@/lib/api/transaction-types';

export interface BillFilter {
  keyword: string;
  payerId: string;
}

export interface BillFilterMember {
  id: string;
  name: string;
}

export interface BillFilterChip {
  key: keyof BillFilter;
  label: string;
}

export function createInitialBillFilter(): BillFilter {
  return { keyword: '', payerId: '' };
}

export function submitBillKeyword(filter: BillFilter, keyword: string): BillFilter {
  return { ...filter, keyword: keyword.trim() };
}

export function clearBillFilter(_filter: BillFilter): BillFilter {
  return createInitialBillFilter();
}

export function removeBillFilter(filter: BillFilter, key: keyof BillFilter): BillFilter {
  return { ...filter, [key]: '' };
}

export function isBillFilterActive(filter: BillFilter): boolean {
  return Boolean(filter.keyword || filter.payerId);
}

export function toBillFilterQuery(filter: BillFilter): Pick<TransactionListQuery, 'keyword' | 'payerId'> {
  return {
    ...(filter.keyword ? { keyword: filter.keyword } : {}),
    ...(filter.payerId ? { payerId: filter.payerId } : {}),
  };
}

export function getBillFilterChips(
  filter: BillFilter,
  members: readonly BillFilterMember[],
): BillFilterChip[] {
  const chips: BillFilterChip[] = [];
  if (filter.keyword) chips.push({ key: 'keyword', label: `关键词：${filter.keyword}` });
  if (filter.payerId) {
    const member = members.find((item) => item.id === filter.payerId);
    chips.push({ key: 'payerId', label: `付款人：${member?.name ?? '未知成员'}` });
  }
  return chips;
}
