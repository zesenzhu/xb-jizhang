import type { ApiSuccessResponse } from './auth-types';
import { userClient } from './user-client';
import type {
  AttachmentAccessUrl,
  AttachmentAccessUrlResponse,
  AttachmentUploadResult,
  AttachmentUploadResultResponse,
  AttachmentUploadSession,
  AttachmentUploadSessionResponse,
  CreateAttachmentUploadInput,
} from './attachment-types';

function unwrap<T>(response: { data: ApiSuccessResponse<T> }): T {
  return response.data.data;
}

export async function createAttachmentUpload(
  ledgerId: string,
  transactionId: string,
  input: CreateAttachmentUploadInput,
): Promise<AttachmentUploadSession> {
  return unwrap(
    await userClient.post<AttachmentUploadSessionResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions/${encodeURIComponent(transactionId)}/attachment-uploads`,
      input,
    ),
  );
}

/**
 * 预签名地址只授予一次对象写入权限，不能复用带 `/api` 基地址和会话拦截器的 userClient。
 * 对象存储返回 403 时只标记附件上传失败，不影响应用登录态。
 */
export async function uploadAttachmentObject(
  uploadUrl: string,
  requiredHeaders: Record<string, string>,
  file: Blob,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: requiredHeaders,
    body: file,
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new AttachmentStorageError(response.status);
  }
}

export async function completeAttachmentUpload(
  ledgerId: string,
  attachmentId: string,
): Promise<AttachmentUploadResult> {
  return unwrap(
    await userClient.post<AttachmentUploadResultResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/attachments/${encodeURIComponent(attachmentId)}/complete`,
    ),
  );
}

export async function getAttachmentAccessUrl(
  ledgerId: string,
  attachmentId: string,
): Promise<AttachmentAccessUrl> {
  return unwrap(
    await userClient.get<AttachmentAccessUrlResponse>(
      `/ledgers/${encodeURIComponent(ledgerId)}/attachments/${encodeURIComponent(attachmentId)}/access-url`,
    ),
  );
}

export async function deleteAttachment(
  ledgerId: string,
  transactionId: string,
  attachmentId: string,
): Promise<null> {
  return unwrap(
    await userClient.delete<ApiSuccessResponse<null>>(
      `/ledgers/${encodeURIComponent(ledgerId)}/transactions/${encodeURIComponent(transactionId)}/attachments/${encodeURIComponent(attachmentId)}`,
    ),
  );
}

export class AttachmentStorageError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('对象存储上传失败');
    this.name = 'AttachmentStorageError';
    this.status = status;
  }
}
