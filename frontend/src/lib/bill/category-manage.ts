import type { CategorySummary, CategoryType } from '@/lib/api/category-types';

export const CATEGORY_NAME_MAX_LENGTH = 50;

export interface CategoryNameValidation {
  /** 去掉首尾空格后的名称，可直接提交 */
  name: string;
  error: string | null;
}

/**
 * 名称校验。
 *
 * 规则与后端 `CreateCategoryDto` 的 `@Length(1, 50)` 对齐，但先 trim 再判长度：
 * 只输入空格必须被拦在前端，否则要等服务端返回 400 才知道。
 */
export function validateCategoryName(raw: string): CategoryNameValidation {
  const name = raw.trim();
  if (name.length === 0) return { name, error: '请输入分类名称' };
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return { name, error: `名称最多 ${CATEGORY_NAME_MAX_LENGTH} 个字` };
  }
  return { name, error: null };
}

export interface ParentOption {
  id: string;
  name: string;
}

/**
 * 可作为父级的候选一级分类。
 *
 * 调用方只传一级分类，并且已按类型过滤；这里唯一的职责是排除自身
 * （分类不能挂到自己下面）。不收 `CategoryNode`，避免调用方为了满足类型
 * 伪造 children / color 字段。
 */
export function parentOptions(
  roots: readonly { id: string; name: string }[],
  editingId: string | null,
): ParentOption[] {
  return roots
    .filter((node) => node.id !== editingId)
    .map((node) => ({ id: node.id, name: node.name }));
}

export interface DeactivateCheck {
  ok: boolean;
  reason: string | null;
}

/**
 * 能否停用某个分类。
 *
 * 后端 `category.service.ts` 在 `isActive: false` 时统计启用的子分类，
 * 大于 0 直接拒绝并提示「请先停用子分类」。前端提前禁用，避免用户白点一次。
 */
export function canDeactivateCategory(activeChildren: number): DeactivateCheck {
  if (activeChildren > 0) {
    return { ok: false, reason: '请先停用子分类' };
  }
  return { ok: true, reason: null };
}

/**
 * 与后端同口径的排序：`sortOrder` 升序，同值按名称升序。
 * 后端 `orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]`。
 */
export function sortCategories<T extends { sortOrder: number; name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

/** 建立 id → 分类 的索引，便于按 parentId 还原路径与统计子分类数量。 */
export function indexById(items: readonly CategorySummary[]): Map<string, CategorySummary> {
  return new Map(items.map((item) => [item.id, item]));
}

/** 某个一级分类下启用中的子分类数量。 */
export function countActiveChildren(
  items: readonly CategorySummary[],
  parentId: string,
): number {
  return items.filter((item) => item.parentId === parentId && item.isActive).length;
}

/** 新建分类时的默认排序值：排在现有同级末位之后。 */
export function nextSortOrder(
  items: readonly CategorySummary[],
  type: CategoryType,
  parentId: string | null,
): number {
  const siblings = items.filter((item) => item.type === type && item.parentId === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((item) => item.sortOrder)) + 10;
}
