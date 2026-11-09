export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_TRANSACTION = 5;
export const ATTACHMENT_USER_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;
export const ATTACHMENT_UPLOAD_TTL_SECONDS = 600;
export const ATTACHMENT_READ_TTL_SECONDS = 300;
export const ATTACHMENT_CLEANUP_INTERVAL_SECONDS = 600;
export const ATTACHMENT_PENDING_TTL_MS = 30 * 60 * 1000;

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number];

/** 只读取文件头判断真实图片类型，不信任客户端声明的 Content-Type。 */
export function detectImageMimeType(buffer: Buffer): AttachmentMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionForMimeType(mimeType: AttachmentMimeType): string {
  return mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
}
