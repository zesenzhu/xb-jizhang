import assert from 'node:assert/strict';
import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { shouldGeneratePrismaClient } from './prisma-client.mjs';

const packageJson = JSON.parse(
  await readFile(new URL('../backend/package.json', import.meta.url), 'utf8'),
);

test('给定后端开发启动命令，则保持迁移后进入 Nest watch', () => {
  const startDevScript = packageJson.scripts['start:dev'];

  assert.equal(typeof startDevScript, 'string');
  assert.equal(startDevScript, 'prisma migrate deploy && nest start --watch');
});

test('给定 Prisma Client 不存在，当启动本地开发环境，则需要生成客户端', async () => {
  const rootDirectory = mkdtempSync(join(tmpdir(), 'xiaobao-jizhang-prisma-'));

  try {
    mkdirSync(join(rootDirectory, 'backend', 'prisma'), { recursive: true });
    writeFileSync(join(rootDirectory, 'backend', 'prisma', 'schema.prisma'), 'datasource db {}');

    assert.equal(await shouldGeneratePrismaClient(rootDirectory), true);
  } finally {
    rmSync(rootDirectory, { recursive: true, force: true });
  }
});

test('给定 Prisma Client 已由当前 schema 生成，当启动本地开发环境，则跳过重复生成', async () => {
  const rootDirectory = mkdtempSync(join(tmpdir(), 'xiaobao-jizhang-prisma-'));
  const schemaPath = join(rootDirectory, 'backend', 'prisma', 'schema.prisma');
  const generatedClientPath = join(rootDirectory, 'backend', 'node_modules', '.prisma', 'client', 'index.d.ts');

  try {
    mkdirSync(join(rootDirectory, 'backend', 'prisma'), { recursive: true });
    mkdirSync(join(rootDirectory, 'backend', 'node_modules', '@prisma', 'client'), { recursive: true });
    mkdirSync(join(rootDirectory, 'backend', 'node_modules', '.prisma', 'client'), { recursive: true });
    writeFileSync(schemaPath, 'datasource db {}');
    writeFileSync(generatedClientPath, 'declare const client: unknown;');
    utimesSync(schemaPath, 1000, 1000);
    utimesSync(generatedClientPath, 2000, 2000);

    assert.equal(await shouldGeneratePrismaClient(rootDirectory), false);
  } finally {
    rmSync(rootDirectory, { recursive: true, force: true });
  }
});

test('给定 schema 比 Prisma Client 更新，当启动本地开发环境，则重新生成客户端', async () => {
  const rootDirectory = mkdtempSync(join(tmpdir(), 'xiaobao-jizhang-prisma-'));
  const schemaPath = join(rootDirectory, 'backend', 'prisma', 'schema.prisma');
  const generatedClientPath = join(rootDirectory, 'backend', 'node_modules', '.prisma', 'client', 'index.d.ts');

  try {
    mkdirSync(join(rootDirectory, 'backend', 'prisma'), { recursive: true });
    mkdirSync(join(rootDirectory, 'backend', 'node_modules', '@prisma', 'client'), { recursive: true });
    mkdirSync(join(rootDirectory, 'backend', 'node_modules', '.prisma', 'client'), { recursive: true });
    writeFileSync(schemaPath, 'datasource db {}');
    writeFileSync(generatedClientPath, 'declare const client: unknown;');
    utimesSync(generatedClientPath, 1000, 1000);
    utimesSync(schemaPath, 2000, 2000);

    assert.equal(await shouldGeneratePrismaClient(rootDirectory), true);
  } finally {
    rmSync(rootDirectory, { recursive: true, force: true });
  }
});
