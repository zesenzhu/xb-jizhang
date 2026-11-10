import assert from 'node:assert/strict';
import {
  buildCategoryTree,
  categoryPathText,
  categorySelectionSheetTitle,
  resolveCategorySelection,
} from '../src/lib/bill/category-tree';
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

// 九宫格显示：一级与二级都是「分类项」，选中二级时该格显示二级本身
import { resolveGridTile } from '../src/lib/bill/category-tree';

const foodNode = buildCategoryTree([
  category({ id: 'food', name: '餐饮', sortOrder: 10 }),
  category({ id: 'breakfast', name: '早餐', parentId: 'food', sortOrder: 10 }),
  category({ id: 'lunch', name: '午餐', parentId: 'food', sortOrder: 20 }),
])[0];

// 未选中：显示一级自身，且保留子级标记
const idle = resolveGridTile(foodNode, null);
assert.equal(idle.node.id, 'food');
assert.equal(idle.isRoot, true);
assert.equal(idle.selected, false);

// 选中一级：显示一级，标记已选
const rootPicked = resolveGridTile(foodNode, 'food');
assert.equal(rootPicked.node.id, 'food');
assert.equal(rootPicked.selected, true);

// 选中二级：该格显示二级本身，不再显示一级
const childPicked = resolveGridTile(foodNode, 'lunch');
assert.equal(childPicked.node.id, 'lunch');
assert.equal(childPicked.node.name, '午餐');
assert.equal(childPicked.selected, true);
assert.equal(childPicked.isRoot, false);

// 选中别的分类：本格不受影响
const otherPicked = resolveGridTile(foodNode, 'transport');
assert.equal(otherPicked.node.id, 'food');
assert.equal(otherPicked.selected, false);

// 打开面板时的预选：上次用过的优先，失效则回退第一个
import { resolveInitialCategoryId } from '../src/lib/bill/category-tree';

const grid = buildCategoryTree([
  category({ id: 'food', name: '餐饮', sortOrder: 10 }),
  category({ id: 'breakfast', name: '早餐', parentId: 'food', sortOrder: 10 }),
  category({ id: 'transport', name: '交通', sortOrder: 20 }),
]);

// 没有记忆：选第一个一级分类
assert.equal(resolveInitialCategoryId(grid, null), 'food');

// 记忆是一级分类：沿用它
assert.equal(resolveInitialCategoryId(grid, 'transport'), 'transport');

// 记忆是二级分类：沿用它（不能回退到一级）
assert.equal(resolveInitialCategoryId(grid, 'breakfast'), 'breakfast');

// 记忆已失效（被停用/删除）：回退第一个
assert.equal(resolveInitialCategoryId(grid, 'deleted-category'), 'food');

// 空分类：返回 null，由调用方走空态
assert.equal(resolveInitialCategoryId([], 'food'), null);

// 分类点击契约：有子分类打开独立二级弹窗，无子分类直接选择。
const nestedSelection = resolveCategorySelection(foodNode);
assert.equal(nestedSelection.kind, 'OPEN_CHILDREN');
if (nestedSelection.kind === 'OPEN_CHILDREN') {
  assert.equal(nestedSelection.node.id, 'food');
}

const leafSelection = resolveCategorySelection(foodNode.children[0]);
assert.deepEqual(leafSelection, { kind: 'SELECT', categoryId: 'breakfast' });

// 二级弹窗标题：选中子级时显示完整路径，否则只显示一级分类。
assert.equal(categorySelectionSheetTitle(foodNode, null), '餐饮');
assert.equal(categorySelectionSheetTitle(foodNode, 'breakfast'), '餐饮 · 早餐');
