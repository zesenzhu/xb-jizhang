import { existsSync } from 'node:fs';
import { join } from 'node:path';

const developmentDefaults = {
  NODE_ENV: 'development',
  PORT: '8091',
  DATABASE_URL: 'postgresql://jizhang:jizhang_dev_password@localhost:5439/jizhang?schema=public',
  REDIS_URL: 'redis://localhost:6389',
  JWT_ACCESS_SECRET: 'development-only-change-this-secret',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_SESSION_TTL_SECONDS: '2592000',
  JWT_ADMIN_ACCESS_SECRET: 'development-only-change-this-admin-secret',
  ADMIN_ACCESS_TOKEN_TTL_SECONDS: '900',
  ADMIN_REFRESH_SESSION_TTL_SECONDS: '2592000',
  CORS_ORIGINS: 'http://localhost:8090',
};

export function createDevelopmentEnvironments(rootDirectory, shellEnvironment = process.env) {
  const backendEnvPath = join(rootDirectory, 'backend', '.env');
  const frontendEnvPath = join(rootDirectory, 'frontend', '.env.local');
  const backendEnvironment = existsSync(backendEnvPath)
    ? { ...shellEnvironment }
    : { ...developmentDefaults, ...shellEnvironment };
  const frontendEnvironment = {
    ...shellEnvironment,
    ...(existsSync(frontendEnvPath)
      ? {}
      : {
          NODE_ENV: shellEnvironment.NODE_ENV ?? 'development',
          PORT: shellEnvironment.FRONTEND_PORT ?? '8090',
          HOSTNAME: shellEnvironment.HOSTNAME ?? '0.0.0.0',
          NEXT_PUBLIC_API_URL:
            shellEnvironment.NEXT_PUBLIC_API_URL ?? 'http://localhost:8091/api',
        }),
  };

  return {
    backend: backendEnvironment,
    frontend: frontendEnvironment,
  };
}

/** 生产接口默认地址；可用 `--api=` 或 `PROD_API_ORIGIN` 覆盖。 */
export const DEFAULT_PROD_API_ORIGIN = 'https://jizhang.xiaobao.work';
export const DEFAULT_FRONTEND_PORT = '8090';

/**
 * 本地前端连生产接口的环境。
 *
 * 关键点：`NEXT_PUBLIC_API_URL` 必须是同源相对路径 `/api`，
 * 由 `next.config.ts` 的 rewrites 代理到生产域名；直接把绝对地址给浏览器会因为
 * `SameSite=Lax` 丢掉生产 Cookie，表现为「登录成功但立刻又退回登录页」。
 */
export function createProductionProxyEnvironment(options = {}) {
  const {
    shellEnvironment = process.env,
    apiOrigin = DEFAULT_PROD_API_ORIGIN,
    frontendPort = DEFAULT_FRONTEND_PORT,
  } = options;

  const normalizedOrigin = apiOrigin.replace(/\/$/, '');

  return {
    ...shellEnvironment,
    NODE_ENV: shellEnvironment.NODE_ENV ?? 'development',
    PORT: shellEnvironment.FRONTEND_PORT ?? frontendPort,
    HOSTNAME: shellEnvironment.HOSTNAME ?? '0.0.0.0',
    NEXT_PUBLIC_API_URL: '/api',
    DEV_API_PROXY_TARGET: normalizedOrigin,
  };
}
