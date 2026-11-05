import type { ApiSuccessResponse } from './auth-types';

export type TransactionType = 'EXPENSE' | 'INCOME';

export interface TransactionCategoryRef {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
}

export interface TransactionAccountRef {
  id: string;
  name: string;
  visibility: string;
}

export interface TransactionPayerRef {
  id: string;
  nickname: string | null;
}

/**
 * 账单列表与详情共用的传输结构，字段与后端 `transactionSelect` 保持一致。
 * 不直接复用 Prisma 模型，避免把内部字段带到页面层。
 */
export interface TransactionSummary {
  id: string;
  ledgerId: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: TransactionCategoryRef | null;
  account: TransactionAccountRef | null;
  payer: TransactionPayerRef | null;
}

export interface TransactionListQuery {
  page?: number;
  pageSize?: number;
  type?: TransactionType;
  categoryId?: string;
  /** 一级分类过滤：匹配该一级分类本身及其全部二级分类 */
  categoryRootId?: string;
  /** 只匹配没有分类的账单；与 categoryId/categoryRootId 互斥 */
  uncategorized?: boolean;
  accountId?: string;
  payerId?: string;
  from?: string;
  to?: string;
  keyword?: string;
}

export interface TransactionListResponse {
  items: TransactionSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export type TransactionListApiResponse = ApiSuccessResponse<TransactionListResponse>;

export interface CreateTransactionInput {
  clientRequestId: string;
  type: TransactionType;
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
  type?: TransactionType;
  amountCents?: number;
  occurredAt?: string;
  categoryId?: string;
  accountId?: string | null;
  payerId?: string | null;
  title?: string | null;
  note?: string | null;
}
