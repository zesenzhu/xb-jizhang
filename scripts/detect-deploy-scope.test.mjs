import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { getDeployScope } from './detect-deploy-scope.mjs';

const scriptPath = fileURLToPath(new URL('./detect-deploy-scope.mjs', import.meta.url));

test('给定只修改后端，当计算发布范围，则只构建后端', () => {
  assert.deepEqual(getDeployScope(['backend/src/app.module.ts']), {
    backend: true,
    frontend: false,
    deployment: false,
    shouldDeploy: true,
  });
});

test('给定只修改前端，当计算发布范围，则只构建前端', () => {
  assert.deepEqual(getDeployScope(['frontend/src/app/page.tsx']), {
    backend: false,
    frontend: true,
    deployment: false,
    shouldDeploy: true,
  });
});

test('给定只修改文档，当计算发布范围，则不触发部署', () => {
  assert.deepEqual(getDeployScope(['docs/技术方向.md']), {
    backend: false,
    frontend: false,
    deployment: false,
    shouldDeploy: false,
  });
});

test('给定修改部署配置，当计算发布范围，则只更新部署配置', () => {
  assert.deepEqual(getDeployScope(['docker-compose.prod.yml', 'docker/nginx/jizhang.conf.example']), {
    backend: false,
    frontend: false,
    deployment: true,
    shouldDeploy: true,
  });
});

test('给定强制发布，当计算发布范围，则前后端都构建', () => {
  assert.deepEqual(getDeployScope(['docs/技术方向.md'], true), {
    backend: true,
    frontend: true,
    deployment: true,
    shouldDeploy: true,
  });
});

test('给定只同步生产配置，当计算发布范围，则触发部署但不构建镜像', () => {
  assert.deepEqual(getDeployScope(['docs/技术方向.md'], false, true), {
    backend: false,
    frontend: false,
    deployment: true,
    shouldDeploy: true,
  });
});

test('给定 GitHub Actions 通过 stdin 执行变更检测，当脚本启动时，则输出范围并写入 GITHUB_OUTPUT', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xiaobao-jizhang-scope-'));
  const outputPath = join(directory, 'github-output');
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end('frontend/src/app/page.tsx\n');
  });
  const output = await readFile(outputPath, 'utf8').catch(() => '');
  await rm(directory, { recursive: true, force: true });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /"frontend":true/);
  assert.match(output, /^frontend=true$/m);
  assert.match(output, /^shouldDeploy=true$/m);
});
