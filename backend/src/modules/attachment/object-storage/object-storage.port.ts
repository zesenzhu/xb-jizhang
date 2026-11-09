export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorageUploadTarget {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectStorageHead {
  contentLength: number;
  contentType: string | null;
  etag: string | null;
}

/**
 * 附件业务只依赖这个端口；MinIO 与 OSS 的签名差异留在适配器里。
 */
export interface ObjectStoragePort {
  createUploadUrl(
    objectKey: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<ObjectStorageUploadTarget>;
  createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  headObject(objectKey: string): Promise<ObjectStorageHead>;
  readPrefix(objectKey: string, bytes: number): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
  ensureCors(origins: readonly string[]): Promise<void>;
}
