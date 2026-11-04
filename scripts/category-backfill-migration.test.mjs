import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL(
  '../backend/prisma/migrations/20261104143000_category_default_backfill/migration.sql',
  import.meta.url,
);

test('给定历史账本缺少分类，当执行分类补齐迁移，则按账本和名称幂等补齐且保留原分类', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /CROSS JOIN default_roots/);
  assert.match(sql, /FROM "ledger"/);
  assert.match(sql, /INSERT INTO "category"/g);
  assert.match(sql, /WHERE NOT EXISTS/g);
  assert.match(sql, /is_system/);
  assert.match(sql, /is_active/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+"category"/i);
  assert.doesNotMatch(sql, /UPDATE\s+"category"/i);
});
