import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';

const repositoryDirectory = fileURLToPath(new URL('..', import.meta.url));
const scriptPath = join(repositoryDirectory, 'scripts/deploy-prod.sh');

async function createFakeDeployment({
  productionEnv,
  productionEnvCandidate,
  releaseEnv,
  changed,
  scriptAtRoot = false,
}) {
  const directory = await mkdtemp(join(tmpdir(), 'xiaobao-jizhang-deploy-'));
  const scriptsDirectory = join(directory, 'scripts');
  const binDirectory = join(directory, 'bin');
  const fakeDockerLog = join(directory, 'docker.log');
  const fakeDocker = join(binDirectory, 'docker');
  const fakeCurl = join(binDirectory, 'curl');
  const deploymentScript = scriptAtRoot
    ? join(directory, 'deploy-prod.sh')
    : join(scriptsDirectory, 'deploy-prod.sh');

  await mkdir(scriptsDirectory);
  await mkdir(binDirectory);
  await cp(scriptPath, deploymentScript);
  await chmod(deploymentScript, 0o755);
  if (scriptAtRoot) {
    await writeFile(
      join(directory, 'backup-prod.sh'),
      '#!/bin/sh\nprintf backup >> "$BACKUP_MARKER"\n',
    );
    await chmod(join(directory, 'backup-prod.sh'), 0o755);
  }
  await writeFile(
    join(directory, 'production.env'),
    productionEnv ?? [
      'DB_USER=test',
      'DB_PASSWORD=password',
      'DB_NAME=jizhang',
      'JWT_ACCESS_SECRET=access',
      'JWT_ADMIN_ACCESS_SECRET=admin-access',
      'CORS_ORIGINS=https://example.com',
      '',
    ].join('\n'),
  );
  if (productionEnvCandidate !== undefined) {
    await writeFile(join(directory, 'production.env.new'), productionEnvCandidate);
  }
  await writeFile(join(directory, 'docker-compose.prod.yml'), 'services: {}\n');
  if (releaseEnv !== undefined) {
    await writeFile(join(directory, 'release.env'), releaseEnv);
  }
  if (changed.backend) {
    await writeFile(join(directory, 'xiaobao-jizhang-backend.tar.gz'), 'backend-image');
  }
  if (changed.frontend) {
    await writeFile(join(directory, 'xiaobao-jizhang-frontend.tar.gz'), 'frontend-image');
  }

  await writeFile(
    fakeDocker,
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$FAKE_DOCKER_LOG"\nexit 0\n',
  );
  await writeFile(fakeCurl, '#!/bin/sh\nexit 0\n');
  await chmod(fakeDocker, 0o755);
  await chmod(fakeCurl, 0o755);

  const environment = {
    ...process.env,
    PATH: `${binDirectory}:${process.env.PATH}`,
    FAKE_DOCKER_LOG: fakeDockerLog,
    BACKUP_MARKER: join(directory, 'backup.marker'),
    RELEASE_TAG: 'new-release',
    BACKEND_CHANGED: String(changed.backend),
    FRONTEND_CHANGED: String(changed.frontend),
    DEPLOYMENT_CHANGED: 'false',
  };
  if (!scriptAtRoot) {
    environment.PRODUCTION_ENV_FILE = join(directory, 'production.env');
    environment.RELEASE_ENV_FILE = join(directory, 'release.env');
    environment.COMPOSE_FILE = join(directory, 'docker-compose.prod.yml');
  }

  const result = await new Promise((resolve) => {
    const child = spawn('sh', [deploymentScript], {
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
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
  });

  const updatedReleaseEnv = await readFile(join(directory, 'release.env'), 'utf8').catch(() => null);
  const updatedProductionEnv = await readFile(join(directory, 'production.env'), 'utf8').catch(() => null);
  const remainingProductionEnvCandidate = await readFile(join(directory, 'production.env.new'), 'utf8').catch(() => null);
  const dockerLog = await readFile(fakeDockerLog, 'utf8').catch(() => '');
  await rm(directory, { recursive: true, force: true });
  return { ...result, updatedReleaseEnv, updatedProductionEnv, remainingProductionEnvCandidate, dockerLog };
}

test('给定只发布前端，当更新版本文件，则保留未变更的后端镜像版本', async () => {
  const result = await createFakeDeployment({
    releaseEnv: [
      'BACKEND_IMAGE=xiaobao-jizhang-backend:old-backend',
      'FRONTEND_IMAGE=xiaobao-jizhang-frontend:old-frontend',
      '',
    ].join('\n'),
    changed: { backend: false, frontend: true },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.updatedReleaseEnv, /^BACKEND_IMAGE=xiaobao-jizhang-backend:old-backend$/m);
  assert.match(result.updatedReleaseEnv, /^FRONTEND_IMAGE=xiaobao-jizhang-frontend:new-release$/m);
  assert.match(result.dockerLog, /run --rm --no-deps backend \.\/node_modules\/\.bin\/prisma migrate deploy/);
});

test('给定首次只提供一个镜像，当开始部署，则在加载镜像前失败', async () => {
  const result = await createFakeDeployment({
    changed: { backend: true, frontend: false },
  });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /首次部署必须同时提供前后端镜像/);
  assert.doesNotMatch(result.dockerLog, /load/);
});

test('给定新的生产配置，当部署配置时，则校验后自动替换服务器配置', async () => {
  const result = await createFakeDeployment({
    productionEnvCandidate: [
      'DB_USER=test',
      'DB_PASSWORD=new-password',
      'DB_NAME=jizhang',
      'JWT_ACCESS_SECRET=new-access',
      'JWT_ADMIN_ACCESS_SECRET=new-admin-access',
      'CORS_ORIGINS=https://new.example.com',
      '',
    ].join('\n'),
    releaseEnv: [
      'BACKEND_IMAGE=xiaobao-jizhang-backend:old-backend',
      'FRONTEND_IMAGE=xiaobao-jizhang-frontend:old-frontend',
      '',
    ].join('\n'),
    changed: { backend: false, frontend: true },
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.updatedProductionEnv, /DB_PASSWORD=new-password/);
  assert.match(result.updatedProductionEnv, /CORS_ORIGINS=https:\/\/new\.example\.com/);
  assert.equal(result.remainingProductionEnvCandidate, null);
  assert.match(result.dockerLog, /up -d --no-build backend frontend/);
});

test('给定新的生产配置缺少管理员密钥，当部署时，则拒绝替换旧配置', async () => {
  const result = await createFakeDeployment({
    productionEnvCandidate: [
      'DB_USER=test',
      'DB_PASSWORD=new-password',
      'DB_NAME=jizhang',
      'JWT_ACCESS_SECRET=new-access',
      'CORS_ORIGINS=https://new.example.com',
      '',
    ].join('\n'),
    releaseEnv: [
      'BACKEND_IMAGE=xiaobao-jizhang-backend:old-backend',
      'FRONTEND_IMAGE=xiaobao-jizhang-frontend:old-frontend',
      '',
    ].join('\n'),
    changed: { backend: false, frontend: false },
  });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /生产环境变量缺少必填项：JWT_ADMIN_ACCESS_SECRET/);
  assert.match(result.updatedProductionEnv, /DB_PASSWORD=password/);
  assert.match(result.remainingProductionEnvCandidate, /DB_PASSWORD=new-password/);
});

test('给定部署脚本直接位于部署目录，当执行发布时，则使用部署目录作为根路径', async () => {
  const result = await createFakeDeployment({
    releaseEnv: [
      'BACKEND_IMAGE=xiaobao-jizhang-backend:old-backend',
      'FRONTEND_IMAGE=xiaobao-jizhang-frontend:old-frontend',
      '',
    ].join('\n'),
    changed: { backend: true, frontend: false },
    scriptAtRoot: true,
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.updatedReleaseEnv, /BACKEND_IMAGE=xiaobao-jizhang-backend:new-release/);
  assert.equal(result.remainingProductionEnvCandidate, null);
  assert.match(result.dockerLog, /up -d --wait --wait-timeout 120 postgres redis/);
});
