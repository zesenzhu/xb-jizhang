import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

test('给定 GitHub Actions 安装后端依赖，当执行类型检查前，则先生成 Prisma Client', () => {
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/ci:ci@localhost:5432\/ci\?schema=public/);
  assert.match(workflow, /run: pnpm --dir backend prisma:generate/);
});

test('给定 Prisma Client 生成步骤，当执行类型检查时，则生成步骤位于类型检查之前', () => {
  const generateIndex = workflow.indexOf('pnpm --dir backend prisma:generate');
  const typecheckIndex = workflow.indexOf('run: pnpm typecheck');

  assert.notEqual(generateIndex, -1);
  assert.notEqual(typecheckIndex, -1);
  assert.ok(generateIndex < typecheckIndex);
});
