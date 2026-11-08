import { spawn } from 'node:child_process';
import process from 'node:process';
import {
  DEFAULT_PROD_API_ORIGIN,
  createDevelopmentEnvironments,
  createProductionProxyEnvironment,
} from './dev-config.mjs';

const rootDirectory = process.cwd();

/**
 * `--target=prod`：只起前端，把 `/api` 代理到生产接口。
 * 不启动 Docker 与本地后端，避免误连本地库或占用 8091。
 */
function parseOptions(argv) {
  const targetArg = argv.find((arg) => arg.startsWith('--target='));
  const apiArg = argv.find((arg) => arg.startsWith('--api='));
  const target = targetArg ? targetArg.split('=')[1] : 'local';
  if (target !== 'local' && target !== 'prod') {
    throw new Error(`未知的 --target=${target}，只支持 local 或 prod`);
  }
  return {
    target,
    apiOrigin: apiArg ? apiArg.slice('--api='.length) : process.env.PROD_API_ORIGIN ?? DEFAULT_PROD_API_ORIGIN,
  };
}

const options = parseOptions(process.argv.slice(2));
const isProductionTarget = options.target === 'prod';
const developmentEnvironments = createDevelopmentEnvironments(rootDirectory);
const children = new Set();
let isShuttingDown = false;

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDirectory,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });

  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function signalProcessGroup(child, signal) {
  if (child.exitCode !== null) return;

  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // 子进程组可能已经退出，继续执行单进程兜底。
    }
  }

  child.kill(signal);
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} 被信号 ${signal} 终止`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function stopChildren(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const child of children) {
    signalProcessGroup(child, 'SIGTERM');
  }

  setTimeout(() => {
    for (const child of children) {
      signalProcessGroup(child, 'SIGKILL');
    }
    process.exit(exitCode);
  }, 1500).unref();
}

async function startFrontendOnly() {
  const frontendEnvironment = createProductionProxyEnvironment({
    shellEnvironment: process.env,
    apiOrigin: options.apiOrigin,
  });

  console.log(`前端：http://localhost:${frontendEnvironment.PORT}`);
  console.log(`接口：${options.apiOrigin}（经 /api 同源代理）`);
  console.log('注意：当前连接的是生产接口，记账、邀请和删除都会写入真实数据。');

  const frontend = spawnProcess('pnpm', ['--dir', 'frontend', 'run', 'dev'], {
    env: frontendEnvironment,
    detached: process.platform !== 'win32',
  });

  frontend.once('exit', (code) => {
    if (!isShuttingDown) {
      console.error(`前端开发进程已退出，退出码：${code ?? '未知'}`);
      stopChildren(code ?? 1);
    }
  });
}

async function main() {
  if (isProductionTarget) {
    await startFrontendOnly();
    return;
  }

  const infraCode = await runOnce('docker', [
    'compose',
    '-f',
    'docker-compose.infra.yml',
    'up',
    '-d',
  ]);

  if (infraCode !== 0) {
    throw new Error('PostgreSQL/Redis 启动失败，请检查 Docker Desktop 状态');
  }

  const backend = spawnProcess('pnpm', ['--dir', 'backend', 'run', 'start:dev'], {
    env: developmentEnvironments.backend,
    detached: process.platform !== 'win32',
  });
  const frontend = spawnProcess('pnpm', ['--dir', 'frontend', 'run', 'dev'], {
    env: developmentEnvironments.frontend,
    detached: process.platform !== 'win32',
  });

  backend.once('exit', (code) => {
    if (!isShuttingDown) {
      console.error(`后端开发进程已退出，退出码：${code ?? '未知'}`);
      stopChildren(code ?? 1);
    }
  });

  frontend.once('exit', (code) => {
    if (!isShuttingDown) {
      console.error(`前端开发进程已退出，退出码：${code ?? '未知'}`);
      stopChildren(code ?? 1);
    }
  });
}

process.once('SIGINT', () => stopChildren(0));
process.once('SIGTERM', () => stopChildren(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stopChildren(1);
});
