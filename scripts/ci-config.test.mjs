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

test('给定生产环境未配置 CORS_ORIGINS，当生成生产配置时，则使用记账正式域名默认值', () => {
  assert.match(
    workflow,
    /CORS_ORIGINS: \$\{\{ vars\.CORS_ORIGINS \|\| 'https:\/\/jizhang\.xiaobao\.work' \}\}/,
  );
  assert.doesNotMatch(workflow, /GitHub Environment 缺少 CORS_ORIGINS/);
});

test('给定部署包已准备，当执行 SCP 上传时，则上传部署目录而不是不稳定的通配符路径', () => {
  assert.match(workflow, /test -n "\$\(find deployment-bundle -type f -print -quit\)"/);
  assert.match(workflow, /source: deployment-bundle\n/);
  assert.doesNotMatch(workflow, /source: deployment-bundle\/\*/);
});
