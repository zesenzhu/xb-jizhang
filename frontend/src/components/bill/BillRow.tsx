import * as React from 'react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import { Paperclip } from 'lucide-react';
import type { TransactionSummary } from '@/lib/api/transaction-types';
import { billSecondaryText, formatBillTime } from '@/lib/bill/bill-group';
import { billCreatorName } from '@/lib/bill/bill-creator';
import { CategoryIcon } from './CategoryIcon';

export interface BillRowProps {
  bill: TransactionSummary;
  onClick?: (bill: TransactionSummary) => void;
}

export function BillRow({ bill, onClick }: BillRowProps): React.JSX.Element {
  const categoryName = bill.category?.name ?? '未分类';
  const secondary = billSecondaryText(bill);
  const time = formatBillTime(bill.occurredAt);
  const isExpense = bill.type === 'EXPENSE';
  const amountText = formatCentsToYuan(bill.amountCents);
  const creatorName = billCreatorName(bill);

  return (
    <button
      type="button"
      onClick={() => onClick?.(bill)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-app-card-subtle/60"
    >
      <CategoryIcon
        name={categoryName}
        icon={bill.category?.icon}
        iconSource={bill.category?.iconSource}
        iconKey={bill.category?.iconKey}
        iconAssetId={bill.category?.iconAssetId}
        iconUrl={bill.category?.iconUrl}
        iconUrlExpiresAt={bill.category?.iconUrlExpiresAt}
        color={bill.category?.color ?? (bill.category ? undefined : null)}
        size="md"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-main">{categoryName}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {time}
          {secondary ? ` · ${secondary}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isExpense ? 'text-rose-500' : 'text-emerald-600',
          )}
        >
          {isExpense ? '-' : '+'}¥{amountText}
        </span>
        {creatorName && (
          <span className="max-w-20 truncate text-[10px] text-text-tertiary">
            {creatorName}
          </span>
        )}
        {(bill.attachmentCount ?? 0) > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-tertiary">
            <Paperclip size={10} />
            {bill.attachmentCount}
          </span>
        )}
      </div>
    </button>
  );
}
