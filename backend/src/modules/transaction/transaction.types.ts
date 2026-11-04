import type { TransactionType } from '@prisma/client';

export interface CreateTransactionInput {
  clientRequestId: string;
  type: Extract<TransactionType, 'EXPENSE' | 'INCOME'>;
  amountCents: number;
  occurredAt: string;
  categoryId: string;
  accountId?: string | null;
  payerId?: string | null;
  title?: string | null;
  note?: string | null;
}

export interface UpdateTransactionInput {
  version: number;
  type?: Extract<TransactionType, 'EXPENSE' | 'INCOME'>;
  amountCents?: number;
  occurredAt?: string;
  categoryId?: string;
  accountId?: string | null;
  payerId?: string | null;
  title?: string | null;
  note?: string | null;
}

export interface TransactionQuery {
  page: number;
  pageSize: number;
  type?: Extract<TransactionType, 'EXPENSE' | 'INCOME'>;
  categoryId?: string;
  accountId?: string;
  payerId?: string;
  from?: string;
  to?: string;
  keyword?: string;
}

export interface TransactionSummary {
  id: string;
  ledgerId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: Date;
  title: string | null;
  note: string | null;
  categoryId: string | null;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  transferGroupId: string | null;
  source: string;
  clientRequestId: string;
  createdById: string;
  updatedById: string;
  payerId: string | null;
  version: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; type: string; name: string; parentId: string | null } | null;
  account: { id: string; name: string; visibility: string } | null;
  payer: { id: string; nickname: string | null } | null;
}
