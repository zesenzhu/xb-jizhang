import type { TransactionAttachmentStatus } from '@prisma/client';
import type { AttachmentMimeType } from './attachment.constants';

export interface CreateAttachmentUploadInput {
  clientRequestId: string;
  fileName: string;
  mimeType: AttachmentMimeType;
  sizeBytes: number;
}

export interface AttachmentUploadSessionResult {
  attachmentId: string;
  status: 'PENDING' | 'ATTACHED';
  uploadMethod: 'PUT';
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: Date;
}

export interface AttachmentSummary {
  id: string;
  status: TransactionAttachmentStatus;
  transactionId: string;
  mimeType: string | null;
  sizeBytes: number | null;
  originalName: string | null;
  createdAt: Date;
}

export interface CompletedAttachmentResult extends AttachmentSummary {
  attachmentCount: number;
  accessUrl: string;
  accessUrlExpiresAt: Date;
}

export interface AttachmentAccessUrlResult {
  attachmentId: string;
  accessUrl: string;
  accessUrlExpiresAt: Date;
}
