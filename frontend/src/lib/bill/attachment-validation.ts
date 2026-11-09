import type { AttachmentDraft } from '@/lib/api/attachment-types';

export const ATTACHMENT_MAX_COUNT = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp';
export const ATTACHMENT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface AttachmentValidationResult {
  accepted: File[];
  errors: string[];
}

export function validateAttachmentFile(file: File): string | null {
  if (!ATTACHMENT_MIME_TYPES.has(file.type)) {
    return '仅支持 JPEG、PNG 或 WebP 图片';
  }
  if (file.size <= 0) {
    return '图片内容为空，无法上传';
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return '单张图片不能超过 10 MB';
  }
  return null;
}

export function validateAttachmentFiles(
  files: readonly File[],
  existingCount = 0,
): AttachmentValidationResult {
  const available = Math.max(ATTACHMENT_MAX_COUNT - existingCount, 0);
  const accepted: File[] = [];
  const errors: string[] = [];

  files.slice(0, available).forEach((file) => {
    const error = validateAttachmentFile(file);
    if (error) errors.push(`${file.name}：${error}`);
    else accepted.push(file);
  });

  if (files.length > available) {
    errors.push(`单笔账单最多添加 ${ATTACHMENT_MAX_COUNT} 张图片`);
  }

  return { accepted, errors };
}

export function createAttachmentDraft(file: File): AttachmentDraft {
  return {
    localId: createId(),
    clientRequestId: createId(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'LOCAL',
    error: null,
  };
}

export function getAttachmentErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '图片上传失败，请稍后重试';
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
