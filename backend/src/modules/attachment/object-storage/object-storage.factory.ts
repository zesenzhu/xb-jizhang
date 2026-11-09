import { ConfigService } from '@nestjs/config';
import { AliyunOssObjectStorage } from './aliyun-oss-object-storage';
import { S3ObjectStorage } from './s3-object-storage';
import type { ObjectStoragePort } from './object-storage.port';

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key)?.trim();
  if (!value) throw new Error(`缺少对象存储配置：${key}`);
  return value;
}

function optional(config: ConfigService, key: string, fallback: string): string {
  return config.get<string>(key)?.trim() || fallback;
}

export function createObjectStorage(config: ConfigService): ObjectStoragePort {
  const provider = optional(config, 'OBJECT_STORAGE_PROVIDER', 'minio');
  if (provider === 'aliyun-oss') {
    const endpoint = required(config, 'OSS_ENDPOINT');
    return new AliyunOssObjectStorage({
      operationEndpoint: optional(config, 'OSS_INTERNAL_ENDPOINT', endpoint),
      signingEndpoint: endpoint,
      region: required(config, 'OSS_REGION'),
      bucket: required(config, 'OSS_BUCKET'),
      accessKeyId: required(config, 'OSS_ACCESS_KEY_ID'),
      accessKeySecret: required(config, 'OSS_ACCESS_KEY_SECRET'),
    });
  }

  if (provider !== 'minio') {
    throw new Error(`不支持的对象存储提供方：${provider}`);
  }

  return new S3ObjectStorage({
    operationEndpoint: required(config, 'MINIO_INTERNAL_ENDPOINT'),
    signingEndpoint: optional(
      config,
      'MINIO_PUBLIC_ENDPOINT',
      required(config, 'MINIO_INTERNAL_ENDPOINT'),
    ),
    region: optional(config, 'MINIO_REGION', 'us-east-1'),
    bucket: required(config, 'MINIO_BUCKET'),
    accessKeyId: required(config, 'MINIO_ACCESS_KEY'),
    secretAccessKey: required(config, 'MINIO_SECRET_KEY'),
    forcePathStyle: optional(config, 'MINIO_FORCE_PATH_STYLE', 'true') === 'true',
  });
}
