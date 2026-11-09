import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  ObjectStorageHead,
  ObjectStoragePort,
  ObjectStorageUploadTarget,
} from './object-storage.port';

export interface S3ObjectStorageOptions {
  operationEndpoint: string;
  signingEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function createClient(options: S3ObjectStorageOptions, endpoint: string): S3Client {
  return new S3Client({
    region: options.region,
    endpoint,
    forcePathStyle: options.forcePathStyle,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });
}

/** MinIO/S3 兼容存储：操作走内部地址，预签名走浏览器可达地址。 */
export class S3ObjectStorage implements ObjectStoragePort {
  private readonly operationClient: S3Client;
  private readonly signingClient: S3Client;

  constructor(private readonly options: S3ObjectStorageOptions) {
    this.operationClient = createClient(options, options.operationEndpoint);
    this.signingClient = createClient(options, options.signingEndpoint);
  }

  async createUploadUrl(
    objectKey: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<ObjectStorageUploadTarget> {
    const url = await getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: objectKey,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
    return {
      url,
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }

  async headObject(objectKey: string): Promise<ObjectStorageHead> {
    const result = await this.operationClient.send(
      new HeadObjectCommand({ Bucket: this.options.bucket, Key: objectKey }),
    );
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
      etag: result.ETag ?? null,
    };
  }

  async readPrefix(objectKey: string, bytes: number): Promise<Buffer> {
    const result = await this.operationClient.send(
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: objectKey,
        Range: `bytes=0-${Math.max(bytes - 1, 0)}`,
      }),
    );
    if (!result.Body) return Buffer.alloc(0);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.operationClient.send(
      new DeleteObjectCommand({ Bucket: this.options.bucket, Key: objectKey }),
    );
  }

  async ensureCors(): Promise<void> {
    // MinIO 通过 MINIO_API_CORS_ALLOW_ORIGIN 在服务端处理 CORS；其 S3 兼容层不支持 PutBucketCors。
    // S3/R2 如需 CORS，请在部署平台配置 Bucket CORS，而不是由应用在启动时写入。
  }
}
