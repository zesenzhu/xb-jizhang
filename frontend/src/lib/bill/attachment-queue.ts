import {
  completeAttachmentUpload,
  createAttachmentUpload,
  uploadAttachmentObject,
} from '@/lib/api/attachment-api';
import type { AttachmentDraft } from '@/lib/api/attachment-types';
import { getAttachmentErrorMessage } from './attachment-validation';

export interface AttachmentUploadProgress {
  localId: string;
  status: 'UPLOADING' | 'ATTACHED' | 'FAILED';
  error: string | null;
}

export interface UploadAttachmentQueueOptions {
  ledgerId: string;
  transactionId: string;
  drafts: readonly AttachmentDraft[];
  concurrency?: number;
  onProgress: (progress: AttachmentUploadProgress) => void;
}

/**
 * 附件必须在账单创建成功后上传。每张图片独立完成确认，单张失败不会阻塞其他图片。
 * 并发限制放在前端，避免移动端同时创建过多签名会话和对象请求。
 */
export async function uploadAttachmentQueue({
  ledgerId,
  transactionId,
  drafts,
  concurrency = 2,
  onProgress,
}: UploadAttachmentQueueOptions): Promise<void> {
  let cursor = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), drafts.length);

  const worker = async (): Promise<void> => {
    while (cursor < drafts.length) {
      const draft = drafts[cursor];
      cursor += 1;
      if (!draft) return;

      onProgress({ localId: draft.localId, status: 'UPLOADING', error: null });
      try {
        const session = await createAttachmentUpload(ledgerId, transactionId, {
          clientRequestId: draft.clientRequestId,
          fileName: draft.file.name,
          mimeType: draft.file.type,
          sizeBytes: draft.file.size,
        });

        if (session.status === 'PENDING') {
          await uploadAttachmentObject(session.uploadUrl, session.requiredHeaders, draft.file);
          await completeAttachmentUpload(ledgerId, session.attachmentId);
        }

        onProgress({ localId: draft.localId, status: 'ATTACHED', error: null });
      } catch (error) {
        onProgress({
          localId: draft.localId,
          status: 'FAILED',
          error: getAttachmentErrorMessage(error),
        });
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
