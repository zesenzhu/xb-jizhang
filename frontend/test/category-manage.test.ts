import assert from 'node:assert/strict';
import {
  canDeactivateCategory,
  countActiveChildren,
  nextSortOrder,
  parentOptions,
  sortCategories,
  validateCategoryName,
} from '../src/lib/bill/category-manage';
import type { CategorySummary } from '../src/lib/api/category-types';

function category(overrides: Partial<CategorySummary> & { id: string; name: string }): CategorySummary {
  return {
    ledgerId: 'ledger-1',
    type: 'EXPENSE',
    icon: null,
    color: null,
    parentId: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

// 名称：去空格、拒空、拒超长
assert.deepEqual(validateCategoryName('  早餐  '), { name: '早餐', error: null });
assert.equal(validateCategoryName('   ').error, '请输入分类名称');
assert.equal(validateCategoryName('').error, '请输入分类名称');
assert.equal(validateCategoryName('x'.repeat(51)).error, '名称最多 50 个字');
assert.equal(validateCategoryName('x'.repeat(50)).error, null);

// 父级候选：排除自身
const roots = [
  { id: 'a', name: '餐饮' },
  { id: 'b', name: '交通' },
];
assert.deepEqual(parentOptions(roots, null), roots);
assert.deepEqual(parentOptions(roots, 'a'), [{ id: 'b', name: '交通' }]);

// 停用检查：有启用子分类时拒绝
assert.deepEqual(canDeactivateCategory(0), { ok: true, reason: null });
assert.deepEqual(canDeactivateCategory(2), { ok: false, reason: '请先停用子分类' });

// 排序：sortOrder 升序，同值按中文拼音
const sorted = sortCategories([
  category({ id: 'c', name: '丙', sortOrder: 30 }),
  category({ id: 'a', name: '乙', sortOrder: 10 }),
  category({ id: 'b', name: '甲', sortOrder: 10 }),
]);
assert.deepEqual(sorted.map((item) => item.name), ['甲', '乙', '丙']);

// 启用子分类计数：停用的不算
const items = [
  category({ id: 'p', name: '医疗健康' }),
  category({ id: 'c1', name: '医疗', parentId: 'p', isActive: true }),
  category({ id: 'c2', name: '药品', parentId: 'p', isActive: false }),
];
assert.equal(countActiveChildren(items, 'p'), 1);
assert.equal(countActiveChildren(items, 'missing'), 0);

// 新建排序值：接在同级末位之后
assert.equal(nextSortOrder([], 'EXPENSE', null), 0);
assert.equal(
  nextSortOrder(
    [
      category({ id: 'x', name: '甲', sortOrder: 10 }),
      category({ id: 'y', name: '乙', sortOrder: 30 }),
    ],
    'EXPENSE',
    null,
  ),
  40,
);
// 只统计同类型、同父级
assert.equal(
  nextSortOrder(
    [
      category({ id: 'x', name: '甲', sortOrder: 10 }),
      category({ id: 'z', name: '工资', type: 'INCOME', sortOrder: 99 }),
    ],
    'EXPENSE',
    null,
  ),
  20,
);

console.log('category manage contract passed');
