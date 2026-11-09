import assert from 'node:assert/strict';
import {
  buildBillDrilldownUrl,
  parseBillDrilldown,
  toBillFilterFromDrilldown,
} from '../src/lib/bill/bill-drilldown';

const START = '2026-10-31T16:00:00.000Z';
const END = '2026-11-30T16:00:00.000Z';
const ROOT = '11111111-1111-4111-8111-111111111111';
const CHILD = '22222222-2222-4222-8222-222222222222';
const ACCOUNT = '33333333-3333-4333-8333-333333333333';
const PAYER = '44444444-4444-4444-8444-444444444444';

function params(entries: Record<string, string>): { get(key: string): string | null } {
  const map = new Map(Object.entries(entries));
  return { get: (key) => map.get(key) ?? null };
}

// 合法下钻：完整解析。
assert.deepEqual(
  parseBillDrilldown(
    params({
      startAt: START,
      endAt: END,
      type: 'EXPENSE',
      categoryRootId: ROOT,
      accountId: ACCOUNT,
      payerId: PAYER,
      keyword: ' 午餐 ',
    }),
  ),
  {
    from: START,
    to: END,
    type: 'EXPENSE',
    categoryRootId: ROOT,
    accountId: ACCOUNT,
    payerId: PAYER,
    keyword: '午餐',
  },
);

// 缺任一时间边界 → 不是下钻，按默认当月处理。
assert.equal(parseBillDrilldown(params({ startAt: START })), null);
assert.equal(parseBillDrilldown(params({ endAt: END })), null);
assert.equal(parseBillDrilldown(params({})), null);

// 时间非法或区间为空 → 整条作废：半截范围会把列表筛成空。
assert.equal(parseBillDrilldown(params({ startAt: 'not-a-date', endAt: END })), null);
assert.equal(parseBillDrilldown(params({ startAt: END, endAt: END })), null);
assert.equal(parseBillDrilldown(params({ startAt: END, endAt: START })), null);

// 单个字段非法只丢该字段，时间范围仍然生效。
assert.deepEqual(parseBillDrilldown(params({ startAt: START, endAt: END, type: 'TRANSFER' })), {
  from: START,
  to: END,
});
assert.deepEqual(parseBillDrilldown(params({ startAt: START, endAt: END, accountId: 'acc-1' })), {
  from: START,
  to: END,
});
assert.deepEqual(
  parseBillDrilldown(params({ startAt: START, endAt: END, keyword: '   ' })),
  { from: START, to: END },
);

// categoryId 与 categoryRootId 服务端互斥：精确分类优先。
assert.deepEqual(
  parseBillDrilldown(
    params({ startAt: START, endAt: END, categoryRootId: ROOT, categoryId: CHILD }),
  ),
  { from: START, to: END, categoryId: CHILD },
);

assert.deepEqual(
  parseBillDrilldown(params({ startAt: START, endAt: END, uncategorized: 'true' })),
  { from: START, to: END, uncategorized: true },
);
assert.deepEqual(
  parseBillDrilldown(
    params({
      startAt: START,
      endAt: END,
      uncategorized: 'true',
      categoryId: CHILD,
      categoryRootId: ROOT,
    }),
  ),
  { from: START, to: END, uncategorized: true },
);

// 下钻条件灌进筛选模型；其余条件保持默认空值。
assert.deepEqual(
  toBillFilterFromDrilldown({ from: START, to: END, type: 'INCOME', categoryRootId: ROOT }),
  {
    keyword: '',
    payerId: '',
    createdById: '',
    type: 'INCOME',
    categoryRootId: ROOT,
    categoryId: '',
    accountId: '',
    from: START,
    to: END,
  },
);
assert.deepEqual(
  toBillFilterFromDrilldown({ from: START, to: END, uncategorized: true }),
  {
    keyword: '',
    payerId: '',
    createdById: '',
    type: '',
    categoryRootId: '',
    categoryId: '',
    uncategorized: true,
    accountId: '',
    from: START,
    to: END,
  },
);

// URL 构造：键顺序固定、空值不输出、值做 URL 编码。
const builtUrl = buildBillDrilldownUrl({
  startAt: START,
  endAt: END,
  type: 'EXPENSE',
  categoryRootId: ROOT,
  accountId: ACCOUNT,
  payerId: PAYER,
  keyword: '午餐 面条',
});
const expectedQuery = new URLSearchParams();
expectedQuery.set('startAt', START);
expectedQuery.set('endAt', END);
expectedQuery.set('type', 'EXPENSE');
expectedQuery.set('categoryRootId', ROOT);
expectedQuery.set('accountId', ACCOUNT);
expectedQuery.set('payerId', PAYER);
expectedQuery.set('keyword', '午餐 面条');
assert.equal(builtUrl, `/user?${expectedQuery.toString()}`);

// 键顺序固定：同一组条件必须生成同一个 URL，否则无法作为幂等依据。
const order = ['startAt', 'endAt', 'type', 'categoryRootId', 'categoryId', 'accountId', 'payerId', 'keyword'];
const positions = order
  .map((key) => builtUrl.indexOf(`${key}=`))
  .filter((index) => index >= 0);
assert.deepEqual(positions, [...positions].sort((left, right) => left - right));

// 没有有效时间边界时退化到默认页面，而不是拼出一串空参数。
assert.equal(buildBillDrilldownUrl({}), '/user');
assert.equal(buildBillDrilldownUrl({ startAt: START, endAt: '' }), '/user');
assert.equal(buildBillDrilldownUrl({ startAt: START, endAt: null }), '/user');

// 构造 → 解析往返一致。
const roundTrip = buildBillDrilldownUrl({ startAt: START, endAt: END, categoryId: CHILD, type: 'INCOME' });
const parsedRoundTrip = parseBillDrilldown(
  new URL(`http://localhost:8090${roundTrip}`).searchParams,
);
assert.deepEqual(parsedRoundTrip, {
  from: START,
  to: END,
  type: 'INCOME',
  categoryId: CHILD,
});

const uncategorizedUrl = buildBillDrilldownUrl({
  startAt: START,
  endAt: END,
  uncategorized: true,
});
assert.deepEqual(
  parseBillDrilldown(new URL(`http://localhost:8090${uncategorizedUrl}`).searchParams),
  { from: START, to: END, uncategorized: true },
);

// 线上 URLSearchParams 也能被解析（页面里拿到的不是 Map）。
assert.deepEqual(
  parseBillDrilldown(new URLSearchParams(`startAt=${encodeURIComponent(START)}&endAt=${encodeURIComponent(END)}`)),
  { from: START, to: END },
);

console.log('bill drilldown contract passed');
