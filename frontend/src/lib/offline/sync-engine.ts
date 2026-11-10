import type {
  AttachmentUploadResult,
  AttachmentUploadSession,
} from '@/lib/api/attachment-types';
import type { TransactionSummary } from '@/lib/api/transaction-types';
import { ApiRequestError } from '@/lib/api/errors';
import { getAttachmentErrorMessage } from '@/lib/bill/attachment-validation';
import {
  completeAttachmentUpload,
  createAttachmentUpload,
  uploadAttachmentObject,
} from '@/lib/api/attachment-api';
import { createTransaction } from '@/lib/api/transaction-api';
import {
  attachmentCacheKey,
  listOfflineAttachments,
  listSyncableTransactions,
  recordLastSync,
  saveAttachmentBlob as persistAttachmentBlob,
  saveAttachmentSummary as persistAttachmentSummary,
  updateOfflineAttachment,
  updateOfflineTransaction,
} from './storage';
import type { OfflineAttachmentRecord, OfflineTransactionRecord } from './storage-types';

export type OfflineSyncFailureKind = 'retryable' | 'unauthorized' | 'failed' | 'conflict';

export interface OfflineSyncResult {
  transactionId: string;
  attachmentFailures: number;
  shouldPause: boolean;
}

export interface OfflineSyncActions {
  createTransaction: (
    ledgerId: string,
    input: OfflineTransactionRecord['payload'],
  ) => Promise<TransactionSummary>;
  listAttachments: (record: OfflineTransactionRecord) => Promise<OfflineAttachmentRecord[]>;
  updateTransaction: (
    localId: string,
    patch: Partial<OfflineTransactionRecord>,
  ) => Promise<OfflineTransactionRecord>;
  updateAttachment: (
    localId: string,
    patch: Partial<OfflineAttachmentRecord>,
  ) => Promise<OfflineAttachmentRecord>;
  saveAttachmentSummary: (result: AttachmentUploadResult, record: OfflineTransactionRecord) => Promise<void>;
  saveAttachmentBlob: (record: OfflineAttachmentRecord, attachmentId: string) => Promise<void>;
  createAttachmentUpload: typeof createAttachmentUpload;
  uploadAttachmentObject: typeof uploadAttachmentObject;
  completeAttachmentUpload: typeof completeAttachmentUpload;
}

export function classifyOfflineSyncError(error: unknown): OfflineSyncFailureKind {
  if (!(error instanceof ApiRequestError)) return 'retryable';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 409 || error.code === 40922) return 'conflict';
  if (error.status === 403 || error.status === 404 || error.code === 40321 || error.code === 40421) {
    return 'failed';
  }
  if (error.status !== undefined && error.status >= 400 && error.status < 500) return 'failed';
  return 'retryable';
}

export async function syncOfflineTransaction(
  record: OfflineTransactionRecord,
  actions: OfflineSyncActions,
): Promise<OfflineSyncResult> {
  let transactionId = record.transactionId;
  if (!transactionId) {
    transactionId = (await actions.createTransaction(record.ledgerId, record.payload)).id;
    await actions.updateTransaction(record.localId, { transactionId });
  }

  const attachments = await actions.listAttachments(record);
  let attachmentFailures = 0;
  let shouldPause = false;
  for (const attachment of attachments) {
    if (attachment.status === 'ATTACHED') continue;
    try {
      await actions.updateAttachment(attachment.localId, { status: 'UPLOADING', lastError: null });
      const session: AttachmentUploadSession = await actions.createAttachmentUpload(
        record.ledgerId,
        transactionId,
        {
          clientRequestId: attachment.clientRequestId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        },
      );
      if (session.status === 'PENDING') {
        await actions.uploadAttachmentObject(session.uploadUrl, session.requiredHeaders, attachment.blob);
        const result = await actions.completeAttachmentUpload(record.ledgerId, session.attachmentId);
        await actions.saveAttachmentSummary(result, record);
        await actions.saveAttachmentBlob(attachment, result.id);
      }
      await actions.updateAttachment(attachment.localId, {
        status: 'ATTACHED',
        attachmentId: session.attachmentId,
        lastError: null,
      });
    } catch (error) {
      const kind = classifyOfflineSyncError(error);
      attachmentFailures += 1;
      await actions.updateAttachment(attachment.localId, {
        status: 'FAILED',
        lastError: getAttachmentErrorMessage(error),
      });
      if (kind === 'retryable' || kind === 'unauthorized') {
        shouldPause = true;
        break;
      }
    }
  }

  return { transactionId, attachmentFailures, shouldPause };
}

export interface OfflineSyncSummary {
  processedCount: number;
  failedCount: number;
  conflictCount: number;
  paused: boolean;
}

export async function syncPendingOfflineTransactions(userId: string): Promise<OfflineSyncSummary> {
  const records = await listSyncableTransactions(userId);
  const actions: OfflineSyncActions = {
    createTransaction,
    listAttachments: (record) => listOfflineAttachments(userId, record.ledgerId, record.localId),
    updateTransaction: updateOfflineTransaction,
    updateAttachment: updateOfflineAttachment,
    saveAttachmentSummary: async (result, record) => {
      const now = new Date().toISOString();
      await persistAttachmentSummary({
        cacheKey: attachmentCacheKey(userId, record.ledgerId, result.id),
        userId,
        ledgerId: record.ledgerId,
        attachmentId: result.id,
        transactionId: result.transactionId,
        status: result.status,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        originalName: result.originalName,
        createdAt: result.createdAt,
        cachedAt: now,
        lastAccessedAt: now,
        cacheState: 'CACHED',
      });
    },
    saveAttachmentBlob: async (attachment, attachmentId) => {
      const now = new Date().toISOString();
      await persistAttachmentBlob({
        cacheKey: attachmentCacheKey(userId, attachment.ledgerId, attachmentId),
        userId,
        ledgerId: attachment.ledgerId,
        attachmentId,
        blob: attachment.blob,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        lastAccessedAt: now,
        createdAt: now,
      });
    },
    createAttachmentUpload,
    uploadAttachmentObject,
    completeAttachmentUpload,
  };
  let processedCount = 0;
  let failedCount = 0;
  let conflictCount = 0;
  let paused = false;

  for (const record of records) {
    await actions.updateTransaction(record.localId, {
      status: 'SYNCING',
      retryCount: record.retryCount + 1,
      lastError: null,
    });
    try {
      const result = await syncOfflineTransaction(record, actions);
      await actions.updateTransaction(record.localId, {
        status: 'SYNCED',
        transactionId: result.transactionId,
        lastError:
          result.attachmentFailures > 0
            ? { code: null, message: '部分附件上传失败，请稍后重试' }
            : null,
      });
      processedCount += 1;
      if (result.shouldPause) {
        paused = true;
        break;
      }
    } catch (error) {
      const kind = classifyOfflineSyncError(error);
      const lastError = {
        code: error instanceof ApiRequestError ? error.code : null,
        message: error instanceof Error ? error.message : '同步失败，请稍后重试',
      };
      await actions.updateTransaction(record.localId, {
        status: kind === 'conflict' ? 'CONFLICT' : kind === 'failed' ? 'FAILED' : 'PENDING',
        lastError,
      });
      if (kind === 'conflict') conflictCount += 1;
      else failedCount += 1;
      if (kind === 'retryable' || kind === 'unauthorized') {
        paused = true;
        break;
      }
    }
  }

  if (processedCount > 0) await recordLastSync(userId, new Date().toISOString());
  return { processedCount, failedCount, conflictCount, paused };
}
