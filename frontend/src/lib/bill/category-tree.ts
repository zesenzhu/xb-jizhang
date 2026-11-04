import type { CategorySummary, CategoryType } from '@/lib/api/category-types';

export interface CategoryNode extends CategorySummary {
  children: CategoryNode[];
}

/**
 * 把扁平分类列表组装成最多两级的树。
 *
 * 服务端只允许两级关系；遇到脏数据时将缺失父级或非法三级记录提升为一级，
 * 确保分类选择不会因为单条异常数据整体不可用。
 */
export function buildCategoryTree(categories: readonly CategorySummary[]): CategoryNode[] {
  const nodes: CategoryNode[] = categories.map((category) => ({ ...category, children: [] }));
  const byId = new Map<string, CategoryNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  const roots: CategoryNode[] = [];
  for (const node of nodes) {
    const parentId = node.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;

    // 父级缺失（脏数据或跨账本引用）时提升为一级，避免整条分类消失。
    if (!parent || parent.id === node.id || parent.parentId) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  roots.sort(compareOrder);
  for (const root of roots) {
    root.children.sort(compareOrder);
  }
  return roots;
}

function compareOrder(left: CategoryNode, right: CategoryNode): number {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.name.localeCompare(right.name, 'zh-CN');
}

/**
 * 九宫格里某一格实际要显示的分类。
 *
 * 一格代表一个「分类项」，一级和二级都是分类项：选中二级时，该格显示二级本身，
 * 而不是继续显示它的一级父类。否则用户选完「其他学习」后，九宫格里看不到任何变化，
 * 只有一行小字写着已选路径。
 */
export interface GridTile {
  /** 该格要显示的分类：选中二级时为二级，否则为一级 */
  node: CategoryNode;
  /** 是否是一级分类自身（决定是否显示子级角标） */
  isRoot: boolean;
  selected: boolean;
}

export function resolveGridTile(node: CategoryNode, selectedId: string | null): GridTile {
  if (node.id === selectedId) {
    return { node, isRoot: true, selected: true };
  }

  const selectedChild = node.children.find((child) => child.id === selectedId);
  if (selectedChild) {
    return { node: selectedChild, isRoot: false, selected: true };
  }

  return { node, isRoot: true, selected: false };
}

/** 按类型筛选，供支出/收入切换使用。 */
export function filterByType(
  categories: readonly CategorySummary[],
  type: CategoryType,
): CategorySummary[] {
  return categories.filter((category) => category.type === type);
}

/** 拼接展示路径，一级分类无子级时只显示自身名称。 */
export function categoryPathText(
  categories: readonly CategorySummary[],
  categoryId: string | null,
): string | null {
  if (!categoryId) return null;
  const target = categories.find((category) => category.id === categoryId);
  if (!target) return null;
  const parent = target.parentId
    ? categories.find((category) => category.id === target.parentId)
    : undefined;
  return parent ? `${parent.name}-${target.name}` : target.name;
}
