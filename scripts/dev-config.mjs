import { existsSync, readFileSync } from 'node:fs';
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

function parseEnvLine(line) {
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) return null;

  const separatorIndex = trimmedLine.indexOf('=');
  if (separatorIndex < 1) return null;

  const key = trimmedLine.slice(0, separatorIndex).trim();
  const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
  const value =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  return [key, value];
}

export function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(parseEnvLine)
      .filter(Boolean),
  );
}

function mergeEnvironment(fileEnvironment, shellEnvironment) {
  return {
    ...fileEnvironment,
    ...shellEnvironment,
  };
}

export function createDevelopmentEnvironments(rootDirectory, shellEnvironment = process.env) {
  const backendFileEnvironment = readEnvFile(join(rootDirectory, 'backend', '.env'));
  const frontendFileEnvironment = readEnvFile(join(rootDirectory, 'frontend', '.env.local'));
  const backendEnvironment = {
    ...developmentDefaults,
    ...mergeEnvironment(backendFileEnvironment, shellEnvironment),
  };
  const frontendEnvironment = {
    ...mergeEnvironment(frontendFileEnvironment, shellEnvironment),
    NODE_ENV: shellEnvironment.NODE_ENV ?? 'development',
    PORT: shellEnvironment.FRONTEND_PORT ?? '8090',
    HOSTNAME: shellEnvironment.HOSTNAME ?? '0.0.0.0',
    NEXT_PUBLIC_API_URL:
      shellEnvironment.NEXT_PUBLIC_API_URL ??
      frontendFileEnvironment.NEXT_PUBLIC_API_URL ??
      'http://localhost:8091/api',
  };

  return {
    backend: backendEnvironment,
    frontend: frontendEnvironment,
  };
}
