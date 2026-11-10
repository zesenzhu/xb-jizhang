import type { CreateTransactionInput, TransactionSummary } from '@/lib/api/transaction-types';

export type OfflineTransactionStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED'
  | 'CONFLICT';

export type OfflineAttachmentStatus =
  | 'LOCAL'
  | 'UPLOADING'
  | 'ATTACHED'
  | 'FAILED';

export interface OfflineTransactionDisplay {
  category: TransactionSummary['category'];
  account: TransactionSummary['account'];
  payer: TransactionSummary['payer'];
  createdBy: NonNullable<TransactionSummary['createdBy']>;
}

export interface OfflineTransactionRecord {
  localId: string;
  userId: string;
  ledgerId: string;
  clientRequestId: string;
  payload: CreateTransactionInput;
  display: OfflineTransactionDisplay;
  attachmentLocalIds: string[];
  status: OfflineTransactionStatus;
  transactionId: string | null;
  retryCount: number;
  lastError: { code: number | null; message: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineAttachmentRecord {
  localId: string;
  userId: string;
  ledgerId: string;
  transactionLocalId: string;
  clientRequestId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: OfflineAttachmentStatus;
  attachmentId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineAttachmentSummaryRecord {
  cacheKey: string;
  userId: string;
  ledgerId: string;
  attachmentId: string;
  transactionId: string;
  status: 'PENDING' | 'ATTACHED' | 'DELETED';
  mimeType: string | null;
  sizeBytes: number | null;
  originalName: string | null;
  createdAt: string;
  cachedAt: string | null;
  lastAccessedAt: string | null;
  cacheState: 'NOT_CACHED' | 'CACHED' | 'PENDING_UPLOAD' | 'DELETED';
}

export interface AttachmentBlobCacheRecord {
  cacheKey: string;
  userId: string;
  ledgerId: string;
  attachmentId: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  lastAccessedAt: string;
  createdAt: string;
}

export type QuerySnapshotKind =
  | 'transactions'
  | 'transaction-details'
  | 'categories'
  | 'accounts'
  | 'members'
  | 'ledgers';

export interface QuerySnapshotRecord {
  cacheKey: string;
  userId: string;
  ledgerId: string | null;
  kind: QuerySnapshotKind;
  value: unknown;
  recordCount: number;
  updatedAt: string;
}

export interface CacheMetadataRecord {
  cacheKey: string;
  userId: string;
  namespace: 'sync';
  lastSyncAt: string | null;
}

export interface LocalCacheStats {
  imageBytes: number;
  imageCount: number;
  transactionSnapshotCount: number;
  pendingTransactionCount: number;
  pendingAttachmentCount: number;
  lastSyncAt: string | null;
}
