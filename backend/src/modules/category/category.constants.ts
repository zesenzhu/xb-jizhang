import type { CategoryType } from '@prisma/client';
import { randomUUID } from 'node:crypto';

interface DefaultCategoryDefinition {
  type: CategoryType;
  key: string;
  name: string;
  sortOrder: number;
  children?: ReadonlyArray<{ key: string; name: string; sortOrder: number }>;
}

/** 一期仅为新账本初始化目录，已有账本不自动改动历史分类。 */
export const DEFAULT_CATEGORIES: ReadonlyArray<DefaultCategoryDefinition> = [
  {
    type: 'EXPENSE', key: 'food', name: '餐饮', sortOrder: 10,
    children: [
      { key: 'breakfast', name: '早餐', sortOrder: 10 },
      { key: 'lunch', name: '午餐', sortOrder: 20 },
      { key: 'dinner', name: '晚餐', sortOrder: 30 },
      { key: 'snacks', name: '饮品零食', sortOrder: 40 },
      { key: 'other', name: '其他餐饮', sortOrder: 90 },
    ],
  },
  {
    type: 'EXPENSE', key: 'transport', name: '交通', sortOrder: 20,
    children: [
      { key: 'public', name: '公共交通', sortOrder: 10 },
      { key: 'taxi', name: '打车', sortOrder: 20 },
      { key: 'driving', name: '自驾', sortOrder: 30 },
      { key: 'long-distance', name: '长途出行', sortOrder: 40 },
    ],
  },
  {
    type: 'EXPENSE', key: 'shopping', name: '购物', sortOrder: 30,
    children: [
      { key: 'daily', name: '日用品', sortOrder: 10 },
      { key: 'clothing', name: '服饰鞋包', sortOrder: 20 },
      { key: 'digital', name: '数码家电', sortOrder: 30 },
      { key: 'other', name: '其他购物', sortOrder: 90 },
    ],
  },
  {
    type: 'EXPENSE', key: 'housing', name: '居住', sortOrder: 40,
    children: [
      { key: 'rent', name: '房租', sortOrder: 10 },
      { key: 'utilities', name: '水电燃气', sortOrder: 20 },
      { key: 'property', name: '物业', sortOrder: 30 },
      { key: 'repair', name: '家居维修', sortOrder: 40 },
    ],
  },
  {
    type: 'EXPENSE', key: 'services', name: '生活服务', sortOrder: 50,
    children: [
      { key: 'telecom', name: '通讯', sortOrder: 10 },
      { key: 'delivery', name: '快递', sortOrder: 20 },
      { key: 'service', name: '生活服务', sortOrder: 30 },
      { key: 'other', name: '其他生活', sortOrder: 90 },
    ],
  },
  {
    type: 'EXPENSE', key: 'health', name: '医疗健康', sortOrder: 60,
    children: [
      { key: 'medical', name: '医疗', sortOrder: 10 },
      { key: 'medicine', name: '药品', sortOrder: 20 },
      { key: 'fitness', name: '运动健身', sortOrder: 30 },
      { key: 'other', name: '其他健康', sortOrder: 90 },
    ],
  },
  {
    type: 'EXPENSE', key: 'education', name: '教育学习', sortOrder: 70,
    children: [
      { key: 'tuition', name: '学费课程', sortOrder: 10 },
      { key: 'books', name: '书籍资料', sortOrder: 20 },
      { key: 'other', name: '其他学习', sortOrder: 90 },
    ],
  },
  {
    type: 'EXPENSE', key: 'entertainment', name: '娱乐休闲', sortOrder: 80,
    children: [
      { key: 'movie', name: '电影演出', sortOrder: 10 },
      { key: 'game', name: '游戏', sortOrder: 20 },
      { key: 'travel', name: '旅游', sortOrder: 30 },
      { key: 'other', name: '其他娱乐', sortOrder: 90 },
    ],
  },
  {
    type: 'EXPENSE', key: 'social', name: '人情往来', sortOrder: 90,
    children: [
      { key: 'gift', name: '礼金红包', sortOrder: 10 },
      { key: 'party', name: '聚会', sortOrder: 20 },
      { key: 'other', name: '其他人情', sortOrder: 90 },
    ],
  },
  { type: 'EXPENSE', key: 'other-expense', name: '其他支出', sortOrder: 100 },
  {
    type: 'INCOME', key: 'salary', name: '工资收入', sortOrder: 10,
    children: [
      { key: 'salary', name: '工资', sortOrder: 10 },
      { key: 'bonus', name: '奖金', sortOrder: 20 },
      { key: 'allowance', name: '补贴', sortOrder: 30 },
    ],
  },
  {
    type: 'INCOME', key: 'business', name: '经营收入', sortOrder: 20,
    children: [
      { key: 'business', name: '经营所得', sortOrder: 10 },
      { key: 'labor', name: '劳务收入', sortOrder: 20 },
      { key: 'other', name: '其他经营', sortOrder: 90 },
    ],
  },
  {
    type: 'INCOME', key: 'investment', name: '投资理财', sortOrder: 30,
    children: [
      { key: 'interest', name: '利息', sortOrder: 10 },
      { key: 'dividend', name: '分红', sortOrder: 20 },
      { key: 'other', name: '其他投资', sortOrder: 90 },
    ],
  },
  {
    type: 'INCOME', key: 'reimbursement', name: '报销退款', sortOrder: 40,
    children: [
      { key: 'reimbursement', name: '报销', sortOrder: 10 },
      { key: 'refund', name: '退款', sortOrder: 20 },
      { key: 'other', name: '其他返还', sortOrder: 90 },
    ],
  },
  {
    type: 'INCOME', key: 'social-income', name: '人情收入', sortOrder: 50,
    children: [
      { key: 'gift', name: '礼金红包', sortOrder: 10 },
      { key: 'other', name: '其他人情', sortOrder: 90 },
    ],
  },
  { type: 'INCOME', key: 'other-income', name: '其他收入', sortOrder: 100 },
];

export function getDefaultCategoryData(ledgerId: string) {
  const data: Array<{
    id: string;
    ledgerId: string;
    type: CategoryType;
    name: string;
    parentId: string | null;
    sortOrder: number;
    isSystem: boolean;
  }> = [];

  for (const category of DEFAULT_CATEGORIES) {
    const parentCategoryId = randomUUID();
    data.push({
      id: parentCategoryId,
      ledgerId,
      type: category.type,
      name: category.name,
      parentId: null,
      sortOrder: category.sortOrder,
      isSystem: true,
    });
    for (const child of category.children ?? []) {
      data.push({
        id: randomUUID(),
        ledgerId,
        type: category.type,
        name: child.name,
        parentId: parentCategoryId,
        sortOrder: child.sortOrder,
        isSystem: true,
      });
    }
  }
  return data;
}
