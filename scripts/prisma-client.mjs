import { realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function readMtime(filePath) {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch {
    return null;
  }
}

export async function shouldGeneratePrismaClient(rootDirectory) {
  const schemaPath = join(rootDirectory, 'backend', 'prisma', 'schema.prisma');
  let generatedClientPath = null;
  try {
    const prismaClientDirectory = await realpath(
      join(rootDirectory, 'backend', 'node_modules', '@prisma', 'client'),
    );
    generatedClientPath = join(prismaClientDirectory, '..', '..', '.prisma', 'client', 'index.d.ts');
  } catch {
    // 依赖未安装或 Prisma Client 尚未生成时，交给调用方执行生成命令。
  }
  const [schemaMtime, generatedClientMtime] = await Promise.all([
    readMtime(schemaPath),
    generatedClientPath ? readMtime(generatedClientPath) : null,
  ]);

  return generatedClientMtime === null || schemaMtime === null || schemaMtime > generatedClientMtime;
}
