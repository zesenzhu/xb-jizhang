import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { createObjectStorage } from '../src/modules/attachment/object-storage/object-storage.factory';

async function main(): Promise<void> {
  const config = new ConfigService();
  const origins = (config.get<string>('STORAGE_CORS_ORIGINS') ?? config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) throw new Error('缺少 STORAGE_CORS_ORIGINS 或 CORS_ORIGINS');
  const provider = config.get<string>('OBJECT_STORAGE_PROVIDER') ?? 'minio';
  if (provider === 'minio') {
    console.log(
      'MinIO 使用 MINIO_API_CORS_ALLOW_ORIGIN 配置 CORS；请确认 docker-compose 中已设置该变量，无需执行此脚本。',
    );
    return;
  }
  await createObjectStorage(config).ensureCors(origins);
  console.log(`对象存储 CORS 已配置：${origins.join(', ')}`);
}

void main();
