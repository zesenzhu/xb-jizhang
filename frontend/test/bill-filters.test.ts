import assert from 'node:assert/strict';
import {
  billFilterDates,
  clearBillFilter,
  createInitialBillFilter,
  getBillFilterChips,
  hasRangeFilter,
  isBillFilterActive,
  removeBillFilter,
  resolveBillScope,
  submitBillKeyword,
  toBillFilterQuery,
  toBillListQuery,
  toStatisticsFilterQuery,
  withBillFilterDates,
} from '../src/lib/bill/bill-filters';

const initial = createInitialBillFilter();

assert.deepEqual(initial, {
  keyword: '',
  payerId: '',
  createdById: '',
  type: '',
  categoryRootId: '',
  categoryId: '',
  accountId: '',
  from: '',
  to: '',
});
assert.equal(isBillFilterActive(initial), false);
assert.equal(hasRangeFilter(initial), false);

// 关键词：只 trim，不改动其它条件。
assert.deepEqual(submitBillKeyword(initial, '  早餐  '), { ...initial, keyword: '早餐' });
assert.deepEqual(submitBillKeyword({ ...initial, payerId: 'user-2' }, '  '), {
  ...initial,
  payerId: 'user-2',
});

// 分类是一个胶囊但对应两个后端参数：移除时必须成对清空，否则列表仍被旧条件过滤。
const withCategory = { ...initial, categoryRootId: 'root-1', categoryId: 'child-1' };
assert.deepEqual(removeBillFilter(withCategory, 'category'), initial);
assert.deepEqual(removeBillFilter(createInitialBillFilter(), 'category'), initial);
assert.deepEqual(removeBillFilter({ ...initial, uncategorized: true }, 'category'), initial);

// 时间范围同理：from/to 必须一起清。
const ranged = { ...initial, from: '2026-10-31T16:00:00.000Z', to: '2026-11-30T16:00:00.000Z' };
assert.deepEqual(removeBillFilter(ranged, 'range'), initial);
assert.equal(hasRangeFilter(ranged), true);

assert.deepEqual(clearBillFilter(withCategory), initial);

// 单条件移除只影响自己。
assert.deepEqual(removeBillFilter({ ...initial, keyword: '早餐', payerId: 'user-2' }, 'keyword'), {
  ...initial,
  payerId: 'user-2',
});

// 胶囊顺序固定：关键词 → 类型 → 分类 → 账户 → 付款人 → 时间。
assert.deepEqual(
  getBillFilterChips(
    {
      keyword: '早餐',
      payerId: 'user-2',
      createdById: 'user-3',
      type: 'EXPENSE',
      categoryRootId: 'root-1',
      categoryId: '',
      accountId: 'acc-1',
      from: '2026-10-31T16:00:00.000Z',
      to: '2026-11-01T16:00:00.000Z',
    },
    {
      members: [
        { id: 'user-2', name: '小宝' },
        { id: 'user-3', name: '小贝' },
      ],
      categories: [{ id: 'root-1', name: '餐饮', parentId: null, type: 'EXPENSE' }],
      accounts: [{ id: 'acc-1', name: '现金' }],
    },
  ),
  [
    { key: 'keyword', label: '关键词：早餐' },
    { key: 'type', label: '类型：支出' },
    { key: 'category', label: '分类：餐饮' },
    { key: 'accountId', label: '账户：现金' },
    { key: 'payerId', label: '付款人：小宝' },
    { key: 'createdById', label: '记账人：小贝' },
    { key: 'range', label: '时间：2026-11-01 至 2026-11-01' },
  ],
);

// 二级分类的胶囊要能看出父子关系。
assert.deepEqual(
  getBillFilterChips(
    { ...initial, categoryId: 'child-1' },
    {
      categories: [
        { id: 'root-1', name: '餐饮', parentId: null, type: 'EXPENSE' },
        { id: 'child-1', name: '午餐', parentId: 'root-1', type: 'EXPENSE' },
      ],
    },
  ),
  [{ key: 'category', label: '分类：餐饮/午餐' }],
);

// 反查不到时降级，不抛错、不显示 undefined。
assert.deepEqual(getBillFilterChips({ ...initial, accountId: 'missing' }), [
  { key: 'accountId', label: '账户：已选账户' },
]);
assert.deepEqual(getBillFilterChips({ ...initial, keyword: '早餐' }), [
  { key: 'keyword', label: '关键词：早餐' },
]);
assert.deepEqual(getBillFilterChips({ ...initial, uncategorized: true }), [
  { key: 'category', label: '分类：未分类' },
]);

// 查询参数：空值全部剔除；分类两字段互斥，精确分类优先。
assert.deepEqual(toBillFilterQuery(initial), {});
assert.deepEqual(
  toBillFilterQuery({
    ...initial,
    keyword: '早餐',
    payerId: 'user-2',
    createdById: 'user-3',
    type: 'INCOME',
  }),
  { keyword: '早餐', payerId: 'user-2', createdById: 'user-3', type: 'INCOME' },
);
assert.deepEqual(toBillFilterQuery({ ...initial, categoryRootId: 'root-1' }), {
  categoryRootId: 'root-1',
});
assert.deepEqual(
  toBillFilterQuery({ ...initial, categoryRootId: 'root-1', categoryId: 'child-1' }),
  { categoryId: 'child-1' },
);
assert.deepEqual(toBillFilterQuery({ ...initial, uncategorized: true }), {
  uncategorized: true,
});
assert.deepEqual(
  toBillFilterQuery({ ...initial, uncategorized: true, categoryRootId: 'root-1' }),
  { categoryRootId: 'root-1' },
);

// 统计接口不接受 from/to：多传会被 DTO 判成非法组合。
assert.deepEqual(
  toStatisticsFilterQuery({
    ...initial,
    keyword: '早餐',
    payerId: 'user-2',
    createdById: 'user-3',
    type: 'EXPENSE',
    categoryRootId: 'root-1',
    from: '2026-10-31T16:00:00.000Z',
    to: '2026-11-30T16:00:00.000Z',
  }),
  {
    keyword: '早餐',
    payerId: 'user-2',
    createdById: 'user-3',
    type: 'EXPENSE',
    categoryRootId: 'root-1',
  },
);
assert.deepEqual(toStatisticsFilterQuery({ ...initial, uncategorized: true }), {
  uncategorized: true,
});

// 月份口径：按账本时区（Asia/Shanghai）算出 UTC 半开区间。
const monthScope = resolveBillScope(initial, { year: 2026, month: 11 }, 'Asia/Shanghai');
assert.equal(monthScope.isCustomRange, false);
assert.equal(monthScope.from, '2026-10-31T16:00:00.000Z');
assert.equal(monthScope.to, '2026-11-30T16:00:00.000Z');
assert.equal(monthScope.rangeLabel, null);
assert.deepEqual(monthScope.statistics, { period: 'MONTH', anchorDate: '2026-11-01' });

// 12 月要跨年进位，不能算出「13 月」。
const decemberScope = resolveBillScope(initial, { year: 2026, month: 12 }, 'Asia/Shanghai');
assert.equal(decemberScope.from, '2026-11-30T16:00:00.000Z');
assert.equal(decemberScope.to, '2026-12-31T16:00:00.000Z');

// 自定义范围优先于月份导航：URL 下钻的范围不能被月份覆盖。
const custom = withBillFilterDates(
  createInitialBillFilter(),
  { fromDate: '2026-11-01', toDate: '2026-11-07' },
  'Asia/Shanghai',
);
const customScope = resolveBillScope(custom, { year: 2026, month: 12 }, 'Asia/Shanghai');
assert.equal(customScope.isCustomRange, true);
assert.equal(customScope.from, '2026-10-31T16:00:00.000Z');
assert.equal(customScope.to, '2026-11-07T16:00:00.000Z');
assert.equal(customScope.rangeLabel, '2026-11-01 至 2026-11-07');
assert.deepEqual(customScope.statistics, {
  period: 'RANGE',
  fromDate: '2026-11-01',
  toDate: '2026-11-07',
});

// 当前自然月从统计页下钻时，月末可能是未来日期；统计接口必须继续使用 MONTH。
const currentMonthDrilldown = withBillFilterDates(
  createInitialBillFilter(),
  { fromDate: '2026-11-01', toDate: '2026-11-30' },
  'Asia/Shanghai',
);
const currentMonthScope = resolveBillScope(
  currentMonthDrilldown,
  { year: 2026, month: 11 },
  'Asia/Shanghai',
);
assert.deepEqual(currentMonthScope.statistics, {
  period: 'MONTH',
  anchorDate: '2026-11-01',
});

// 本地日期 ↔ UTC 半开区间往返一致。
assert.deepEqual(billFilterDates(custom, 'Asia/Shanghai'), {
  fromDate: '2026-11-01',
  toDate: '2026-11-07',
});
assert.deepEqual(billFilterDates(initial, 'Asia/Shanghai'), { fromDate: '', toDate: '' });

// 只填一端时面板已禁用提交，这里必须保持原值而不是写进半截范围。
assert.deepEqual(
  withBillFilterDates(createInitialBillFilter(), { fromDate: '2026-11-01', toDate: '' }),
  createInitialBillFilter(),
);
assert.deepEqual(
  withBillFilterDates(ranged, { fromDate: '', toDate: '' }),
  createInitialBillFilter(),
);

// 列表参数：from/to 一律取自 scope，页码不进边界计算。
assert.deepEqual(toBillListQuery({ ...initial, keyword: '早餐' }, { year: 2026, month: 11 }, 'Asia/Shanghai', 2, 30), {
  page: 2,
  pageSize: 30,
  keyword: '早餐',
  from: '2026-10-31T16:00:00.000Z',
  to: '2026-11-30T16:00:00.000Z',
});

console.log('bill filters contract passed');
