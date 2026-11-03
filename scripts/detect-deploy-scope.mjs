import { readFileSync } from 'node:fs';

const BACKEND_PREFIXES = ['backend/'];
const FRONTEND_PREFIXES = ['frontend/'];
const DEPLOYMENT_PREFIXES = [
  '.github/workflows/',
  'docker/',
  'scripts/backup-prod.sh',
  'scripts/deploy-prod.sh',
  'docker-compose.prod.yml',
  '.env.production.example',
];

function startsWithAny(path, prefixes) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function getDeployScope(paths, forceAll = false) {
  const changedPaths = paths.map((path) => path.trim()).filter(Boolean);
  const backend = forceAll || changedPaths.some((path) => startsWithAny(path, BACKEND_PREFIXES));
  const frontend = forceAll || changedPaths.some((path) => startsWithAny(path, FRONTEND_PREFIXES));
  const deployment = forceAll || changedPaths.some((path) => startsWithAny(path, DEPLOYMENT_PREFIXES));

  return {
    backend,
    frontend,
    deployment,
    shouldDeploy: backend || frontend || deployment,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = readFileSync(0, 'utf8').split('\n');
  const scope = getDeployScope(input, process.env.FORCE_ALL === 'true');
  const output = process.env.GITHUB_OUTPUT;

  if (output) {
    const lines = Object.entries(scope).map(([key, value]) => `${key}=${value}`);
    await import('node:fs/promises').then(({ appendFile }) => appendFile(output, `${lines.join('\n')}\n`));
  }

  console.log(JSON.stringify(scope));
}
