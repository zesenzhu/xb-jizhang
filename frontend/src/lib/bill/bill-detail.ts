import { formatCentsToYuan } from '@/lib/utils';
import type { TransactionSummary } from '@/lib/api/transaction-types';
import type { LedgerMemberSummary } from '@/lib/api/member-types';

/**
 * 详情页的展示模型。
 *
 * 页面只消费这个结构，不再自己判断「哪个字段为空就不渲染」：
 * 该判断属于展示规则，放在纯函数里才能被测试覆盖，也避免编辑态与只读态分叉。
 */
export interface BillDetailField {
  key: string;
  label: string;
  value: string;
}

export interface BillDetailView {
  isExpense: boolean;
  signedAmount: string;
  categoryName: string;
  /** 发生时间、账户、商家、备注、付款人；只包含有值的项 */
  facts: BillDetailField[];
  /** 记账人、最后修改人、创建时间、更新时间 */
  audit: BillDetailField[];
}

export interface MemberDirectory {
  /** userId → 展示名 */
  readonly byId: ReadonlyMap<string, string>;
}

const UNKNOWN_MEMBER = '未知成员';

/** 从成员列表构建 userId → 昵称 的映射；昵称缺失时回退用户名。 */
export function buildMemberDirectory(members: readonly LedgerMemberSummary[]): MemberDirectory {
  const byId = new Map<string, string>();
  for (const member of members) {
    const name = member.user.nickname?.trim() || member.user.username;
    byId.set(member.userId, name);
  }
  return { byId };
}

function memberName(directory: MemberDirectory, userId: string | null): string {
  if (!userId) return UNKNOWN_MEMBER;
  return directory.byId.get(userId) ?? UNKNOWN_MEMBER;
}

/**
 * 把账单记录映射为详情展示模型。
 *
 * 规则（对应《账单详情》2.1 字段映射）：
 * - 账户 / 商家 / 备注为空时整行不渲染，不用「—」占位
 * - 实际付款人只在支出且确实填写时出现
 * - 记账人、最后修改人查不到昵称时显示「未知成员」
 */
export function toBillDetailView(
  bill: TransactionSummary,
  directory: MemberDirectory,
  formatDateTime: (iso: string) => string,
): BillDetailView {
  const isExpense = bill.type === 'EXPENSE';

  const facts: BillDetailField[] = [
    { key: 'occurredAt', label: '发生时间', value: formatDateTime(bill.occurredAt) },
  ];

  if (bill.account?.name) {
    facts.push({ key: 'account', label: '账户', value: bill.account.name });
  }
  if (bill.title?.trim()) {
    facts.push({ key: 'title', label: '商家/对象', value: bill.title.trim() });
  }
  if (bill.note?.trim()) {
    facts.push({ key: 'note', label: '备注', value: bill.note.trim() });
  }
  if (isExpense && bill.payerId) {
    // 后端已 join payer，但老数据可能只有 ID；两者都缺时回退成员表。
    const payerName = bill.payer?.nickname?.trim() || memberName(directory, bill.payerId);
    facts.push({ key: 'payer', label: '实际付款人', value: payerName });
  }

  const audit: BillDetailField[] = [
    { key: 'createdBy', label: '记账人', value: memberName(directory, bill.createdById) },
    { key: 'updatedBy', label: '最后修改', value: memberName(directory, bill.updatedById) },
    { key: 'createdAt', label: '创建时间', value: formatDateTime(bill.createdAt) },
    { key: 'updatedAt', label: '更新时间', value: formatDateTime(bill.updatedAt) },
  ];

  return {
    isExpense,
    // 金额带符号：支出为负，收入为正；符号与账单行一致。
    signedAmount: `${isExpense ? '-' : '+'}¥${formatCentsToYuan(bill.amountCents)}`,
    categoryName: bill.category?.name ?? '未分类',
    facts,
    audit,
  };
}

export interface DetailPermissions {
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * 操作权限。后端才是安全边界（`transaction.service.ts` 的 update/remove），
 * 这里只决定按钮显隐：VIEWER 全禁；EDITOR 只能删自己创建的。
 */
export function resolveDetailPermissions(
  role: 'OWNER' | 'EDITOR' | 'VIEWER' | undefined,
  bill: Pick<TransactionSummary, 'createdById'>,
  currentUserId: string | null,
): DetailPermissions {
  if (role === 'VIEWER' || role === undefined) {
    return { canEdit: false, canDelete: false };
  }
  if (role === 'OWNER') {
    return { canEdit: true, canDelete: true };
  }
  // EDITOR：可编辑，仅可删除自己创建的
  return { canEdit: true, canDelete: currentUserId !== null && bill.createdById === currentUserId };
}
