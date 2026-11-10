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

test('给定附件功能开启，当生成生产配置时，则注入 OSS 参数和凭据并在缺失时失败', () => {
  assert.match(workflow, /ATTACHMENT_ENABLED: \$\{\{ vars\.ATTACHMENT_ENABLED \|\| 'false' \}\}/);
  assert.match(workflow, /OBJECT_STORAGE_PROVIDER: \$\{\{ vars\.OBJECT_STORAGE_PROVIDER \|\| 'aliyun-oss' \}\}/);
  assert.match(workflow, /OSS_INTERNAL_ENDPOINT: \$\{\{ vars\.OSS_INTERNAL_ENDPOINT \|\| '' \}\}/);
  assert.match(workflow, /OSS_ACCESS_KEY_ID: \$\{\{ secrets\.OSS_ACCESS_KEY_ID \}\}/);
  assert.match(workflow, /OSS_ACCESS_KEY_SECRET: \$\{\{ secrets\.OSS_ACCESS_KEY_SECRET \}\}/);
  assert.match(workflow, /附件已开启，但 GitHub Environment 缺少 OSS_BUCKET/);
});

test('给定部署包已准备，当执行 SCP 上传时，则上传部署目录而不是不稳定的通配符路径', () => {
  assert.match(workflow, /test -n "\$\(find deployment-bundle -type f -print -quit\)"/);
  assert.match(workflow, /source: deployment-bundle\n/);
  assert.doesNotMatch(workflow, /source: deployment-bundle\/\*/);
});

test('给定部署包由 umask 077 创建，当执行 Docker SCP 上传时，则为临时包开放读取权限', () => {
  assert.match(workflow, /chmod 755 deployment-bundle/);
  assert.match(workflow, /find deployment-bundle -type f -exec chmod 644/);
});

test('给定推送发布 Tag，当计算变更范围，则比较当前 Tag 与上一个 Tag 之间的差异', () => {
  assert.match(workflow, /if \[ "\$\{GITHUB_REF_TYPE:-\}" = "tag" \]; then/);
  assert.match(workflow, /git describe --tags --abbrev=0 "\$\{GITHUB_SHA\}\^"/);
  assert.match(workflow, /git rev-list -n 1 "\$previous_tag"/);
});

test('给定首次发布 Tag 没有上一个 Tag，当计算变更范围，则以空树作为比较基准', () => {
  assert.match(workflow, /git hash-object -t tree \/dev\/null/);
});
