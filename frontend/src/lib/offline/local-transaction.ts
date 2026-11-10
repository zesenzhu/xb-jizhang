import type { UserSummary } from '@/lib/api/auth-types';
import type { AccountSummary } from '@/lib/api/account-types';
import type { CategorySummary } from '@/lib/api/category-types';
import type {
  CreateTransactionInput,
  TransactionListQuery,
  TransactionSummary,
} from '@/lib/api/transaction-types';
import type { OfflineAttachmentRecord, OfflineTransactionRecord } from './storage-types';

export interface CreateOfflineTransactionOptions {
  localId: string;
  user: UserSummary;
  ledgerId: string;
  payload: CreateTransactionInput;
  category: CategorySummary | null;
  account: AccountSummary | null;
  payer: TransactionSummary['payer'];
  attachments: readonly OfflineAttachmentRecord[];
  now?: string;
}

export function createOfflineTransactionRecord(
  options: CreateOfflineTransactionOptions,
): OfflineTransactionRecord {
  const now = options.now ?? new Date().toISOString();
  return {
    localId: options.localId,
    userId: options.user.id,
    ledgerId: options.ledgerId,
    clientRequestId: options.payload.clientRequestId,
    payload: options.payload,
    display: {
      category: options.category
        ? {
            id: options.category.id,
            type: options.category.type,
            name: options.category.name,
            parentId: options.category.parentId,
          }
        : null,
      account: options.account
        ? {
            id: options.account.id,
            name: options.account.name,
            visibility: options.account.visibility,
          }
        : null,
      payer: options.payer,
      createdBy: {
        id: options.user.id,
        username: options.user.username,
        nickname: options.user.nickname,
        avatar: options.user.avatar,
      },
    },
    attachmentLocalIds: options.attachments.map((attachment) => attachment.localId),
    status: 'PENDING',
    transactionId: null,
    retryCount: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function toLocalTransactionSummary(record: OfflineTransactionRecord): TransactionSummary {
  return {
    id: `local:${record.localId}`,
    ledgerId: record.ledgerId,
    type: record.payload.type,
    amountCents: record.payload.amountCents,
    occurredAt: record.payload.occurredAt,
    title: record.payload.title ?? null,
    note: record.payload.note ?? null,
    categoryId: record.payload.categoryId,
    accountId: record.payload.accountId ?? null,
    fromAccountId: null,
    toAccountId: null,
    transferGroupId: null,
    source: 'MANUAL',
    clientRequestId: record.clientRequestId,
    createdById: record.display.createdBy.id,
    createdBy: record.display.createdBy,
    updatedById: record.display.createdBy.id,
    payerId: record.payload.payerId ?? null,
    version: 0,
    deletedAt: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    category: record.display.category,
    account: record.display.account,
    payer: record.display.payer,
    attachmentCount: record.attachmentLocalIds.length,
  };
}

export function matchesTransactionQuery(
  transaction: TransactionSummary,
  query: TransactionListQuery,
): boolean {
  if (query.type && transaction.type !== query.type) return false;
  if (query.categoryId && transaction.categoryId !== query.categoryId) return false;
  if (query.categoryRootId) {
    const category = transaction.category;
    if (!category || (category.id !== query.categoryRootId && category.parentId !== query.categoryRootId)) {
      return false;
    }
  }
  if (query.uncategorized && transaction.categoryId !== null) return false;
  if (query.accountId && transaction.accountId !== query.accountId) return false;
  if (query.payerId && transaction.payerId !== query.payerId) return false;
  if (query.createdById && transaction.createdById !== query.createdById) return false;
  if (query.from && transaction.occurredAt < query.from) return false;
  if (query.to && transaction.occurredAt >= query.to) return false;
  if (query.keyword) {
    const keyword = query.keyword.trim().toLocaleLowerCase();
    const text = `${transaction.title ?? ''} ${transaction.note ?? ''}`.toLocaleLowerCase();
    if (!text.includes(keyword)) return false;
  }
  return true;
}
