import type {
  ObjectStorageHead,
  ObjectStoragePort,
  ObjectStorageUploadTarget,
} from './object-storage.port';

/** 附件功能关闭时仍允许应用启动；所有对象操作显式失败，避免误以为存储可用。 */
export class DisabledObjectStorage implements ObjectStoragePort {
  private unavailable(): never {
    throw new Error('附件对象存储未启用');
  }

  createUploadUrl(): Promise<ObjectStorageUploadTarget> {
    return Promise.reject(this.unavailable());
  }

  createDownloadUrl(): Promise<string> {
    return Promise.reject(this.unavailable());
  }

  headObject(): Promise<ObjectStorageHead> {
    return Promise.reject(this.unavailable());
  }

  readPrefix(): Promise<Buffer> {
    return Promise.reject(this.unavailable());
  }

  deleteObject(): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  ensureCors(): Promise<void> {
    return Promise.reject(this.unavailable());
  }
}
