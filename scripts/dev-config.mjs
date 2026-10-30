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
