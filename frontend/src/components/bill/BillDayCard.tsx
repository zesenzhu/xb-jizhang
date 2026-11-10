import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn, formatCentsToYuan } from '@/lib/utils';
import type { TransactionSummary } from '@/lib/api/transaction-types';
import type { BillDayGroup } from '@/lib/bill/bill-group';
import { BillRow } from './BillRow';

export interface BillDayCardProps {
  group: BillDayGroup;
  ledgerId?: string;
  userId?: string | null;
  onSelectBill?: (bill: TransactionSummary) => void;
}

export function BillDayCard({ group, ledgerId, userId = null, onSelectBill }: BillDayCardProps): React.JSX.Element {
  const [collapsed, setCollapsed] = React.useState(false);
  const hasExpense = group.expenseCents > 0;
  const hasIncome = group.incomeCents > 0;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-baseline gap-1.5">
          {group.isToday && <span className="text-xs font-semibold text-primary">今天</span>}
          {group.isYesterday && <span className="text-xs font-semibold text-primary">昨天</span>}
          <span className="text-xs font-medium text-text-muted">{group.label}</span>
          <span className="text-xs text-text-tertiary">{group.weekday}</span>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-main"
        >
          {hasExpense && <span>支出: ¥{formatCentsToYuan(group.expenseCents)}</span>}
          {hasExpense && hasIncome && <span className="text-text-tertiary">·</span>}
          {hasIncome && <span className="text-emerald-600">收入: ¥{formatCentsToYuan(group.incomeCents)}</span>}
          <ChevronDown size={14} className={cn('transition-transform', collapsed && '-rotate-90')} />
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-app-divider overflow-hidden rounded-2xl border border-app-border bg-app-card shadow-xs">
          {group.items.map((bill) => (
            <BillRow
              key={bill.id}
              bill={bill}
              ledgerId={ledgerId}
              userId={userId}
              onClick={onSelectBill}
            />
          ))}
        </div>
      )}
    </section>
  );
}
