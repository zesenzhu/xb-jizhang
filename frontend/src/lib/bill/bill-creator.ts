import type { TransactionSummary } from '@/lib/api/transaction-types';

/** 列表/详情共用的创建人展示名；昵称为空时回退用户名，不做「未知成员」占位。 */
export function billCreatorName(
  bill: { createdBy?: TransactionSummary['createdBy'] },
): string {
  return bill.createdBy?.nickname?.trim() || bill.createdBy?.username?.trim() || '';
}
