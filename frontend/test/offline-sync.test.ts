import assert from 'node:assert/strict';
import type { AttachmentUploadResult, AttachmentUploadSession } from '../src/lib/api/attachment-types';
import type { TransactionSummary } from '../src/lib/api/transaction-types';
import { ApiRequestError } from '../src/lib/api/errors';
import {
  classifyOfflineSyncError,
  syncOfflineTransaction,
  type OfflineSyncActions,
} from '../src/lib/offline/sync-engine';
import type { OfflineAttachmentRecord, OfflineTransactionRecord } from '../src/lib/offline/storage-types';

const transaction: TransactionSummary = {
  id: 'transaction-1',
  ledgerId: 'ledger-1',
  type: 'EXPENSE',
  amountCents: 100,
  occurredAt: '2026-11-10T08:00:00.000Z',
  title: '早餐',
  note: null,
  categoryId: 'category-1',
  accountId: null,
  fromAccountId: null,
  toAccountId: null,
  transferGroupId: null,
  source: 'MANUAL',
  clientRequestId: 'request-1',
  createdById: 'user-1',
  updatedById: 'user-1',
  payerId: null,
  version: 1,
  deletedAt: null,
  createdAt: '2026-11-10T08:00:00.000Z',
  updatedAt: '2026-11-10T08:00:00.000Z',
  category: { id: 'category-1', type: 'EXPENSE', name: '餐饮', parentId: null },
  account: null,
  payer: null,
};

const record: OfflineTransactionRecord = {
  localId: 'local-1',
  userId: 'user-1',
  ledgerId: 'ledger-1',
  clientRequestId: 'request-1',
  payload: {
    clientRequestId: 'request-1',
    type: 'EXPENSE',
    amountCents: 100,
    occurredAt: '2026-11-10T08:00:00.000Z',
    categoryId: 'category-1',
  },
  display: {
    category: transaction.category,
    account: null,
    payer: null,
    createdBy: { id: 'user-1', username: 'xiaobao', nickname: '小宝', avatar: null },
  },
  attachmentLocalIds: ['attachment-1'],
  status: 'PENDING',
  transactionId: null,
  retryCount: 0,
  lastError: null,
  createdAt: '2026-11-10T08:00:00.000Z',
  updatedAt: '2026-11-10T08:00:00.000Z',
};

const attachment: OfflineAttachmentRecord = {
  localId: 'attachment-1',
  userId: 'user-1',
  ledgerId: 'ledger-1',
  transactionLocalId: 'local-1',
  clientRequestId: 'attachment-request-1',
  blob: new Blob(['image']),
  fileName: 'receipt.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 5,
  status: 'LOCAL',
  attachmentId: null,
  lastError: null,
  createdAt: '2026-11-10T08:00:00.000Z',
  updatedAt: '2026-11-10T08:00:00.000Z',
};

const session: AttachmentUploadSession = {
  attachmentId: 'attachment-server-1',
  status: 'PENDING',
  uploadMethod: 'PUT',
  uploadUrl: 'https://storage.example.test/receipt',
  requiredHeaders: {},
  expiresAt: '2026-11-10T09:00:00.000Z',
};

const uploadResult: AttachmentUploadResult = {
  id: 'attachment-server-1',
  status: 'ATTACHED',
  transactionId: 'transaction-1',
  mimeType: 'image/jpeg',
  sizeBytes: 5,
  originalName: 'receipt.jpg',
  createdAt: '2026-11-10T08:00:00.000Z',
  attachmentCount: 1,
};

function makeActions(overrides: Partial<OfflineSyncActions> = {}): OfflineSyncActions {
  return {
    createTransaction: async () => transaction,
    listAttachments: async () => [attachment],
    updateTransaction: async (_localId, patch) => ({ ...record, ...patch }),
    updateAttachment: async (_localId, patch) => ({ ...attachment, ...patch }),
    saveAttachmentSummary: async () => undefined,
    saveAttachmentBlob: async () => undefined,
    createAttachmentUpload: async () => session,
    uploadAttachmentObject: async () => undefined,
    completeAttachmentUpload: async () => uploadResult,
    ...overrides,
  };
}

assert.equal(
  classifyOfflineSyncError(new ApiRequestError({ success: false, code: 40922, message: '冲突', data: null }, 409)),
  'conflict',
);
assert.equal(
  classifyOfflineSyncError(new ApiRequestError({ success: false, code: 40101, message: '未登录', data: null }, 401)),
  'unauthorized',
);
assert.equal(classifyOfflineSyncError(new Error('网络断开')), 'retryable');

void (async () => {
  const events: string[] = [];
  const result = await syncOfflineTransaction(record, makeActions({
    createTransaction: async () => {
      events.push('create');
      return transaction;
    },
    createAttachmentUpload: async () => {
      events.push('session');
      return session;
    },
    uploadAttachmentObject: async () => {
      events.push('upload');
    },
    completeAttachmentUpload: async () => {
      events.push('complete');
      return uploadResult;
    },
  }));
  assert.deepEqual(events, ['create', 'session', 'upload', 'complete']);
  assert.deepEqual(result, { transactionId: 'transaction-1', attachmentFailures: 0, shouldPause: false });

  const failed = await syncOfflineTransaction(record, makeActions({
    uploadAttachmentObject: async () => {
      throw new Error('网络断开');
    },
  }));
  assert.equal(failed.attachmentFailures, 1);
  assert.equal(failed.shouldPause, true);
  console.log('offline sync contract passed');
})();
