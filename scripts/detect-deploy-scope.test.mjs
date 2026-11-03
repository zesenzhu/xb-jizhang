import assert from 'node:assert/strict';
import test from 'node:test';
import { getDeployScope } from './detect-deploy-scope.mjs';

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
