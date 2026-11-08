import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDevelopmentEnvironments, createProductionProxyEnvironment } from './dev-config.mjs';

function createFixtureRoot() {
  const rootDirectory = mkdtempSync(join(tmpdir(), 'xiaobao-jizhang-dev-'));
  mkdirSync(join(rootDirectory, 'backend'));
  mkdirSync(join(rootDirectory, 'frontend'));
  return rootDirectory;
}

test('给定没有本地环境文件，当创建开发环境时，则使用安全的开发默认值', () => {
  const rootDirectory = createFixtureRoot();

  try {
    const environments = createDevelopmentEnvironments(rootDirectory, {});

    assert.equal(
      environments.backend.DATABASE_URL,
      'postgresql://jizhang:jizhang_dev_password@localhost:5439/jizhang?schema=public',
    );
    assert.equal(environments.backend.REDIS_URL, 'redis://localhost:6389');
    assert.equal(environments.frontend.NEXT_PUBLIC_API_URL, 'http://localhost:8091/api');
  } finally {
    rmSync(rootDirectory, { recursive: true, force: true });
  }
});

test('给定本地环境文件，当创建开发环境时，则交给框架原生解析环境文件', () => {
  const rootDirectory = createFixtureRoot();

  try {
    writeFileSync(
      join(rootDirectory, 'backend', '.env'),
      'DATABASE_URL="postgresql://from-file#with-comment"\nREDIS_URL="redis://from-file"\n',
    );
    writeFileSync(
      join(rootDirectory, 'frontend', '.env.local'),
      'NEXT_PUBLIC_API_URL=http://from-file/api\n',
    );

    const fileEnvironments = createDevelopmentEnvironments(rootDirectory, {});

    assert.equal(fileEnvironments.backend.DATABASE_URL, undefined);
    assert.equal(fileEnvironments.backend.REDIS_URL, undefined);
    assert.equal(fileEnvironments.frontend.NEXT_PUBLIC_API_URL, undefined);

    const shellEnvironments = createDevelopmentEnvironments(rootDirectory, {
      DATABASE_URL: 'postgresql://from-shell',
      NEXT_PUBLIC_API_URL: 'http://from-shell/api',
    });

    assert.equal(shellEnvironments.backend.DATABASE_URL, 'postgresql://from-shell');
    assert.equal(shellEnvironments.frontend.NEXT_PUBLIC_API_URL, 'http://from-shell/api');
  } finally {
    rmSync(rootDirectory, { recursive: true, force: true });
  }
});

test('给定生产接口模式，当创建环境时，则浏览器侧使用同源 /api 并配置代理目标', () => {
  const environment = createProductionProxyEnvironment({
    shellEnvironment: {},
    apiOrigin: 'https://jizhang.xiaobao.work/',
  });

  // 浏览器必须走同源相对路径，否则生产 Cookie（SameSite=Lax）不会随跨站请求发送。
  assert.equal(environment.NEXT_PUBLIC_API_URL, '/api');
  assert.equal(environment.DEV_API_PROXY_TARGET, 'https://jizhang.xiaobao.work');
  assert.equal(environment.PORT, '8090');
});

test('给定自定义生产接口，当创建环境时，则代理目标使用自定义地址并去掉末尾斜杠', () => {
  const environment = createProductionProxyEnvironment({
    shellEnvironment: {},
    apiOrigin: 'https://staging.example.com/',
    frontendPort: '8095',
  });

  assert.equal(environment.DEV_API_PROXY_TARGET, 'https://staging.example.com');
  assert.equal(environment.NEXT_PUBLIC_API_URL, '/api');
  assert.equal(environment.PORT, '8095');
});
