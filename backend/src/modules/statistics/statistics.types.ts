import type { TransactionType } from '@prisma/client';

export interface StatisticsQuery {
  from?: string;
  to?: string;
  type?: Extract<TransactionType, 'EXPENSE' | 'INCOME'>;
  categoryId?: string;
  accountId?: string;
  payerId?: string;
  keyword?: string;
}

export interface StatisticsOverview {
  from: string | null;
  to: string | null;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  transactionCount: number;
}
