import OSS from 'ali-oss';
import type {
  ObjectStorageHead,
  ObjectStoragePort,
  ObjectStorageUploadTarget,
} from './object-storage.port';

export interface AliyunOssOptions {
  operationEndpoint: string;
  signingEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
}

function createClient(options: AliyunOssOptions, endpoint: string): OSS {
  return new OSS({
    region: options.region,
    endpoint,
    bucket: options.bucket,
    accessKeyId: options.accessKeyId,
    accessKeySecret: options.accessKeySecret,
    secure: endpoint.startsWith('https://'),
  });
}

/** 阿里云 OSS：签名使用浏览器可达 Endpoint，HEAD/读取/删除使用服务端地址。 */
export class AliyunOssObjectStorage implements ObjectStoragePort {
  private readonly operationClient: OSS;
  private readonly signingClient: OSS;

  constructor(private readonly options: AliyunOssOptions) {
    this.operationClient = createClient(options, options.operationEndpoint);
    this.signingClient = createClient(options, options.signingEndpoint);
  }

  async createUploadUrl(
    objectKey: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<ObjectStorageUploadTarget> {
    const url = this.signingClient.signatureUrl(objectKey, {
      method: 'PUT',
      expires: expiresInSeconds,
      'Content-Type': contentType,
    });
    return {
      url,
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    return this.signingClient.signatureUrl(objectKey, { expires: expiresInSeconds });
  }

  async headObject(objectKey: string): Promise<ObjectStorageHead> {
    const result = await this.operationClient.head(objectKey);
    const headers = result.res.headers as Record<string, string | number | undefined>;
    const contentLength = Number(headers['content-length'] ?? 0);
    return {
      contentLength: Number.isFinite(contentLength) ? contentLength : 0,
      contentType: headers['content-type'] ? String(headers['content-type']) : null,
      etag: headers.etag ? String(headers.etag) : null,
    };
  }

  async readPrefix(objectKey: string, bytes: number): Promise<Buffer> {
    const result = await this.operationClient.get(objectKey, {
      headers: { Range: `bytes=0-${Math.max(bytes - 1, 0)}` },
    });
    return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.operationClient.delete(objectKey);
  }

  async ensureCors(origins: readonly string[] = []): Promise<void> {
    await this.operationClient.putBucketCORS(this.options.bucket, [
      {
        allowedOrigin: [...origins],
        allowedMethod: ['GET', 'PUT', 'HEAD'],
        allowedHeader: ['*'],
        exposeHeader: ['ETag', 'Content-Length', 'Content-Type'],
        maxAgeSeconds: '3000',
      },
    ]);
  }
}
