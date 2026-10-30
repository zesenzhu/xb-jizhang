import { spawn } from 'node:child_process';
import process from 'node:process';

const rootDirectory = process.cwd();
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
    if (!child.killed) child.kill('SIGTERM');
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 1500).unref();
}

async function main() {
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

  const backend = spawnProcess('pnpm', ['--dir', 'backend', 'run', 'start:dev']);
  const frontend = spawnProcess('pnpm', ['--dir', 'frontend', 'run', 'dev']);

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
