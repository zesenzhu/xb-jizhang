import type { CategoryType } from '@prisma/client';

export const DEFAULT_CATEGORIES: ReadonlyArray<{
  type: CategoryType;
  name: string;
  sortOrder: number;
}> = [
  { type: 'EXPENSE', name: '餐饮', sortOrder: 10 },
  { type: 'EXPENSE', name: '交通', sortOrder: 20 },
  { type: 'INCOME', name: '工资', sortOrder: 10 },
  { type: 'INCOME', name: '其他收入', sortOrder: 20 },
];

export function getDefaultCategoryData(ledgerId: string) {
  return DEFAULT_CATEGORIES.map((category) => ({
    ledgerId,
    ...category,
    isSystem: true,
  }));
}
