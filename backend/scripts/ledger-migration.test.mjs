import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
const migrationPath = new URL(
  '../prisma/migrations/20261104170000_ledger_timezone_preferences_copy/migration.sql',
  import.meta.url,
);

test(
  '给定旧账本和成员数据，当应用二期账本迁移，则保留归档账本并回填时区、偏好和复制约束',
  { skip: !databaseUrl },
  async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    const schema = `ledger_migration_${randomUUID().replaceAll('-', '')}`;

    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query('CREATE TABLE "user" ("id" TEXT PRIMARY KEY)');
      await client.query(
        'CREATE TABLE "ledger" ("id" TEXT PRIMARY KEY, "is_archived" BOOLEAN NOT NULL DEFAULT false)',
      );
      await client.query(
        'CREATE TABLE "ledger_member" ("id" TEXT PRIMARY KEY, "ledger_id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "status" TEXT NOT NULL, "joined_at" TIMESTAMP(3) NOT NULL)',
      );
      await client.query(`
        INSERT INTO "user" ("id") VALUES ('user-1'), ('user-2'), ('user-3');
        INSERT INTO "ledger" ("id", "is_archived")
        VALUES ('ledger-old', true), ('ledger-new', false), ('ledger-left', false), ('ledger-copy', false);
        INSERT INTO "ledger_member" ("id", "ledger_id", "user_id", "status", "joined_at")
        VALUES
          ('member-old', 'ledger-old', 'user-1', 'ACTIVE', '2026-01-01T00:00:00Z'),
          ('member-new', 'ledger-new', 'user-1', 'ACTIVE', '2026-02-01T00:00:00Z'),
          ('member-left', 'ledger-left', 'user-2', 'LEFT', '2026-01-01T00:00:00Z');
      `);

      const migration = await readFile(migrationPath, 'utf8');
      await client.query(migration);

      const ledgerRows = await client.query(
        'SELECT "id", "is_archived", "timezone" FROM "ledger" ORDER BY "id"',
      );
      assert.deepEqual(
        ledgerRows.rows,
        [
          { id: 'ledger-copy', is_archived: false, timezone: 'Asia/Shanghai' },
          { id: 'ledger-left', is_archived: false, timezone: 'Asia/Shanghai' },
          { id: 'ledger-new', is_archived: false, timezone: 'Asia/Shanghai' },
          { id: 'ledger-old', is_archived: true, timezone: 'Asia/Shanghai' },
        ],
      );

      const preferences = await client.query(
        'SELECT "user_id", "current_ledger_id", "default_ledger_id" FROM "user_ledger_preference" ORDER BY "user_id"',
      );
      assert.deepEqual(preferences.rows, [
        {
          user_id: 'user-1',
          current_ledger_id: 'ledger-old',
          default_ledger_id: 'ledger-old',
        },
      ]);

      await client.query(`
        INSERT INTO "ledger_copy_request" (
          "id", "user_id", "client_request_id", "source_ledger_id", "target_ledger_id"
        ) VALUES ('copy-request-1', 'user-1', 'request-1', 'ledger-new', 'ledger-copy');
      `);
      await assert.rejects(
        client.query(`
          INSERT INTO "ledger_copy_request" (
            "id", "user_id", "client_request_id", "source_ledger_id", "target_ledger_id"
          ) VALUES ('copy-request-2', 'user-1', 'request-1', 'ledger-new', 'ledger-left');
        `),
      );

      await client.query('DELETE FROM "ledger" WHERE "id" = $1', ['ledger-copy']);
      const copyRequest = await client.query(
        'SELECT "target_ledger_id" FROM "ledger_copy_request" WHERE "id" = $1',
        ['copy-request-1'],
      );
      assert.equal(copyRequest.rows[0].target_ledger_id, null);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
      await pool.end();
    }
  },
);
