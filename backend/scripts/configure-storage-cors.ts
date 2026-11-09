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
  await createObjectStorage(config).ensureCors(origins);
  console.log(`对象存储 CORS 已配置：${origins.join(', ')}`);
}

void main();
