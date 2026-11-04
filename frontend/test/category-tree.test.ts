import assert from 'node:assert/strict';
import { buildCategoryTree, categoryPathText } from '../src/lib/bill/category-tree';
import type { CategorySummary } from '../src/lib/api/category-types';

function category(overrides: Partial<CategorySummary> & { id: string; name: string }): CategorySummary {
  return {
    ledgerId: 'ledger-1',
    type: 'EXPENSE',
    parentId: null,
    icon: null,
    color: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

// parentId 为空时为一级分类，点击即可选中。
const flat = buildCategoryTree([
  category({ id: 'a', name: '餐饮', sortOrder: 10 }),
  category({ id: 'b', name: '交通', sortOrder: 20 }),
]);
assert.equal(flat.length, 2);
assert.deepEqual(flat.map((node) => node.name), ['餐饮', '交通']);
assert.deepEqual(flat[0].children, []);

// parentId 存在时组装两级：子级挂到对应父级，父级保留自身可选。
const nested = buildCategoryTree([
  category({ id: 'food', name: '餐饮', sortOrder: 10 }),
  category({ id: 'breakfast', name: '早餐', parentId: 'food', sortOrder: 1 }),
  category({ id: 'lunch', name: '午餐', parentId: 'food', sortOrder: 2 }),
]);
assert.equal(nested.length, 1);
assert.equal(nested[0].children.length, 2);
assert.deepEqual(nested[0].children.map((node) => node.name), ['早餐', '午餐']);

// parentId 指向不存在的分类时提升为一级，不丢数据。
const orphan = buildCategoryTree([
  category({ id: 'x', name: '孤儿', parentId: 'missing' }),
]);
assert.equal(orphan.length, 1);
assert.equal(orphan[0].id, 'x');

// 不允许三级：子级的 parentId 指向另一个子级时，该节点提升为一级。
const threeLevel = buildCategoryTree([
  category({ id: 'l1', name: '一级' }),
  category({ id: 'l2', name: '二级', parentId: 'l1' }),
  category({ id: 'l3', name: '三级', parentId: 'l2' }),
]);
assert.equal(threeLevel.length, 2);
assert.equal(threeLevel.find((node) => node.id === 'l1')?.children.length, 1);
assert.equal(threeLevel.find((node) => node.id === 'l3')?.children.length, 0);

// 排序：sortOrder 优先，同值时按中文拼音升序（甲 jia < 乙 yi）。
const sorted = buildCategoryTree([
  category({ id: 'c', name: '丙', sortOrder: 30 }),
  category({ id: 'a', name: '乙', sortOrder: 10 }),
  category({ id: 'b', name: '甲', sortOrder: 10 }),
]);
assert.deepEqual(sorted.map((node) => node.name), ['甲', '乙', '丙']);

// 路径文案：有父级显示「父-子」，无父级只显示自身。
const withParent = [
  category({ id: 'food', name: '餐饮' }),
  category({ id: 'breakfast', name: '早餐', parentId: 'food' }),
];
assert.equal(categoryPathText(withParent, 'breakfast'), '餐饮-早餐');
assert.equal(categoryPathText(withParent, 'food'), '餐饮');
assert.equal(categoryPathText(withParent, null), null);
assert.equal(categoryPathText(withParent, 'missing'), null);

console.log('category tree contract passed');
