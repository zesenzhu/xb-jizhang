import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Client, type QueryResultRow } from 'pg';
import {
  buildStatisticsDayCountQuery,
  buildStatisticsPeriodAggregateQuery,
} from './statistics-query';
import type { ResolvedStatisticsGranularity } from './statistics.types';

interface AggregateRow extends QueryResultRow {
  periodStart: string;
  expenseCents: string;
  incomeCents: string;
  transactionCount: number;
}

interface TestContainer {
  Mounts: Array<{
    Type: string;
    Name: string;
    Destination: string;
  }>;
  Config: { Labels: Record<string, string> };
  NetworkSettings: {
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
  };
}

const hasTestConfiguration = Boolean(
  process.env.STATISTICS_TEST_DATABASE_URL ||
    process.env.STATISTICS_TEST_CONTAINER,
);
const describeWithDatabase = hasTestConfiguration ? describe : describe.skip;

function getTestDatabaseConfig(): { databaseUrl: string; containerName: string } {
  const databaseUrl = process.env.STATISTICS_TEST_DATABASE_URL;
  const containerName = process.env.STATISTICS_TEST_CONTAINER;
  if (!databaseUrl || !containerName?.startsWith('xj-statfix-')) {
    throw new Error('必须显式指定本任务创建的隔离 PostgreSQL 容器和连接地址');
  }
  return { databaseUrl, containerName };
}

function toPostgresValues(values: readonly unknown[]): unknown[] {
  // PrismaPg 将 Date 编码为 UTC 时间文本；node-postgres 默认使用进程本地时区。
  return values.map((value) =>
    value instanceof Date
      ? value.toISOString().replace('T', ' ').replace('Z', '')
      : value,
  );
}

describeWithDatabase('statistics query PostgreSQL integration', () => {
  jest.setTimeout(30_000);

  let client: Client;

  beforeAll(async () => {
    const { databaseUrl, containerName } = getTestDatabaseConfig();
    const url = new URL(databaseUrl);
    assert.equal(url.hostname, '127.0.0.1');
    const containers = JSON.parse(
      execFileSync('docker', ['inspect', containerName], { encoding: 'utf8' }),
    ) as TestContainer[];
    assert.equal(containers.length, 1);
    const [container] = containers;
    assert.equal(container.Config.Labels['xiaobao.statistics-regression'], 'true');
    assert.ok(
      container.Mounts.every(
        (mount) =>
          mount.Type === 'volume' &&
          /^[a-f0-9]{64}$/.test(mount.Name) &&
          mount.Destination === '/var/lib/postgresql/data',
      ),
    );
    assert.deepEqual(container.NetworkSettings.Ports['5432/tcp'], [
      { HostIp: '127.0.0.1', HostPort: url.port },
    ]);

    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    const version = await client.query<{ server_version_num: string }>(
      'SHOW server_version_num',
    );
    assert.equal(Math.floor(Number(version.rows[0].server_version_num) / 10000), 16);

    await client.query('BEGIN');
    await client.query(`
      SET LOCAL TIME ZONE 'UTC';
      CREATE TEMP TABLE account (id text, ledger_id text, visibility text, owner_id text);
      CREATE TEMP TABLE category (id text, ledger_id text, parent_id text);
      CREATE TEMP TABLE ledger_member (ledger_id text, user_id text, status text);
      CREATE TEMP TABLE "transaction" (
        id text, ledger_id text, type text, amount_cents integer,
        occurred_at timestamp, deleted_at timestamp, category_id text,
        account_id text, payer_id text, title text, note text
      );
      INSERT INTO category VALUES ('root', 'ledger', NULL), ('child', 'ledger', 'root');
      INSERT INTO account VALUES ('hidden', 'ledger', 'PRIVATE', 'other');
      INSERT INTO "transaction" (id, ledger_id, type, amount_cents, occurred_at, deleted_at, category_id, account_id) VALUES
        ('root', 'ledger', 'EXPENSE', 100, '2026-09-30 16:00:00', NULL, 'root', NULL),
        ('child', 'ledger', 'EXPENSE', 200, '2026-10-01 15:59:59.999', NULL, 'child', NULL),
        ('income', 'ledger', 'INCOME', 1000, '2026-10-01 16:00:00', NULL, NULL, NULL),
        ('deleted', 'ledger', 'EXPENSE', 9000, '2026-10-01 16:00:00', '2026-10-02', 'child', NULL),
        ('private', 'ledger', 'EXPENSE', 9000, '2026-10-01 16:00:00', NULL, 'child', 'hidden'),
        ('transfer', 'ledger', 'TRANSFER', 9000, '2026-10-01 16:00:00', NULL, NULL, NULL),
        ('foreign', 'other', 'EXPENSE', 9000, '2026-10-01 16:00:00', NULL, NULL, NULL),
        ('end', 'ledger', 'EXPENSE', 9000, '2026-10-02 16:00:00', NULL, NULL, NULL);
    `);
  });

  beforeEach(async () => {
    await client.query('SAVEPOINT statistics_test_case');
  });

  afterEach(async () => {
    await client.query('ROLLBACK TO SAVEPOINT statistics_test_case');
    await client.query('RELEASE SAVEPOINT statistics_test_case');
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('ROLLBACK');
    await client.end();
  });

  const occurredAt = {
    gte: new Date('2026-09-30T16:00:00.000Z'),
    lt: new Date('2026-10-02T16:00:00.000Z'),
  };

  async function aggregate(
    granularity: ResolvedStatisticsGranularity,
    categoryRootId?: string,
  ): Promise<AggregateRow[]> {
    const sql = buildStatisticsPeriodAggregateQuery(
      'owner',
      'ledger',
      { categoryRootId },
      occurredAt,
      'Asia/Shanghai',
      granularity,
    );
    return (await client.query<AggregateRow>(sql.text, toPostgresValues(sql.values)))
      .rows;
  }

  it('给定跨 UTC 日的账单，当按上海自然日分组，则正确汇总且不触发分组错误', async () => {
    expect(await aggregate('DAY')).toEqual([
      {
        periodStart: '2026-10-01',
        expenseCents: '300',
        incomeCents: '0',
        transactionCount: 2,
      },
      {
        periodStart: '2026-10-02',
        expenseCents: '0',
        incomeCents: '1000',
        transactionCount: 1,
      },
    ]);
  });

  it('给定月与年粒度，当执行周期聚合，则合并同一自然周期的收支', async () => {
    for (const [granularity, periodStart] of [
      ['MONTH', '2026-10-01'],
      ['YEAR', '2026-01-01'],
    ] as const) {
      expect(await aggregate(granularity)).toEqual([
        {
          periodStart,
          expenseCents: '300',
          incomeCents: '1000',
          transactionCount: 3,
        },
      ]);
    }
  });

  it('给定根分类筛选，当执行周期聚合，则包括根分类和直接子分类', async () => {
    expect(await aggregate('DAY', 'root')).toEqual([
      {
        periodStart: '2026-10-01',
        expenseCents: '300',
        incomeCents: '0',
        transactionCount: 2,
      },
    ]);
  });

  it('给定没有匹配分类的筛选，当执行周期聚合，则返回空结果', async () => {
    expect(await aggregate('DAY', 'missing')).toEqual([]);
  });

  it('给定相同时间范围，当统计有效自然日，则返回两个本地日期', async () => {
    const sql = buildStatisticsDayCountQuery(
      'owner',
      'ledger',
      {},
      occurredAt,
      'Asia/Shanghai',
    );
    expect(
      (
        await client.query<{ count: number }>(
          sql.text,
          toPostgresValues(sql.values),
        )
      ).rows,
    ).toEqual([{ count: 2 }]);
  });

  it('给定纽约夏令时切换，当按本地日分组，则 23 小时的一天仍是一个周期', async () => {
    await client.query(`DELETE FROM "transaction";
      INSERT INTO "transaction" (id, ledger_id, type, amount_cents, occurred_at) VALUES
      ('start', 'ledger', 'EXPENSE', 11, '2026-03-08 05:00:00'),
      ('last', 'ledger', 'EXPENSE', 22, '2026-03-09 03:59:59.999'),
      ('end', 'ledger', 'EXPENSE', 99, '2026-03-09 04:00:00');`);
    const sql = buildStatisticsPeriodAggregateQuery(
      'owner',
      'ledger',
      {},
      {
        gte: new Date('2026-03-08T05:00:00.000Z'),
        lt: new Date('2026-03-09T04:00:00.000Z'),
      },
      'America/New_York',
      'DAY',
    );
    expect(
      (
        await client.query<AggregateRow>(
          sql.text,
          toPostgresValues(sql.values),
        )
      ).rows,
    ).toEqual([
      {
        periodStart: '2026-03-08',
        expenseCents: '33',
        incomeCents: '0',
        transactionCount: 2,
      },
    ]);
  });
});
