import type { ApiSuccessResponse } from './auth-types';

export type AttachmentStatus = 'PENDING' | 'ATTACHED' | 'DELETED';

export interface TransactionAttachmentSummary {
  id: string;
  status: AttachmentStatus;
  transactionId: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string | null;
  accessUrl?: string;
  accessUrlExpiresAt?: string;
  createdAt: string;
}

export interface AttachmentUploadSession {
  attachmentId: string;
  status: 'PENDING' | 'ATTACHED';
  uploadMethod: 'PUT';
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface AttachmentUploadResult extends TransactionAttachmentSummary {
  attachmentCount: number;
}

export interface AttachmentAccessUrl {
  attachmentId: string;
  accessUrl: string;
  accessUrlExpiresAt: string;
}

export interface CreateAttachmentUploadInput {
  clientRequestId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type AttachmentUploadSessionResponse = ApiSuccessResponse<AttachmentUploadSession>;
export type AttachmentUploadResultResponse = ApiSuccessResponse<AttachmentUploadResult>;
export type AttachmentAccessUrlResponse = ApiSuccessResponse<AttachmentAccessUrl>;

export interface AttachmentDraft {
  localId: string;
  clientRequestId: string;
  file: File;
  previewUrl: string;
  status: 'LOCAL' | 'UPLOADING' | 'ATTACHED' | 'FAILED';
  error: string | null;
}
