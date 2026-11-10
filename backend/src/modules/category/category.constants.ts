import type { CategoryType } from "@prisma/client";
import { randomUUID } from "node:crypto";

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
    type: "EXPENSE",
    key: "food",
    name: "餐饮",
    sortOrder: 10,
    children: [
      { key: "breakfast", name: "早餐", sortOrder: 10 },
      { key: "lunch", name: "午餐", sortOrder: 20 },
      { key: "dinner", name: "晚餐", sortOrder: 30 },
      { key: "snacks", name: "饮品零食", sortOrder: 40 },
      { key: "other", name: "其他餐饮", sortOrder: 90 },
    ],
  },
  {
    type: "EXPENSE",
    key: "transport",
    name: "交通",
    sortOrder: 20,
    children: [
      { key: "public", name: "公共交通", sortOrder: 10 },
      { key: "taxi", name: "打车", sortOrder: 20 },
      { key: "driving", name: "自驾", sortOrder: 30 },
      { key: "long-distance", name: "长途出行", sortOrder: 40 },
    ],
  },
  {
    type: "EXPENSE",
    key: "shopping",
    name: "购物",
    sortOrder: 30,
    children: [
      { key: "daily", name: "日用品", sortOrder: 10 },
      { key: "clothing", name: "服饰鞋包", sortOrder: 20 },
      { key: "digital", name: "数码家电", sortOrder: 30 },
      { key: "other", name: "其他购物", sortOrder: 90 },
    ],
  },
  {
    type: "EXPENSE",
    key: "housing",
    name: "居住",
    sortOrder: 40,
    children: [
      { key: "rent", name: "房租", sortOrder: 10 },
      { key: "utilities", name: "水电燃气", sortOrder: 20 },
      { key: "property", name: "物业", sortOrder: 30 },
      { key: "repair", name: "家居维修", sortOrder: 40 },
    ],
  },
  {
    type: "EXPENSE",
    key: "services",
    name: "生活服务",
    sortOrder: 50,
    children: [
      { key: "telecom", name: "通讯", sortOrder: 10 },
      { key: "delivery", name: "快递", sortOrder: 20 },
      { key: "service", name: "生活服务", sortOrder: 30 },
      { key: "other", name: "其他生活", sortOrder: 90 },
    ],
  },
  {
    type: "EXPENSE",
    key: "health",
    name: "医疗健康",
    sortOrder: 60,
    children: [
      { key: "medical", name: "医疗", sortOrder: 10 },
      { key: "medicine", name: "药品", sortOrder: 20 },
      { key: "fitness", name: "运动健身", sortOrder: 30 },
      { key: "other", name: "其他健康", sortOrder: 90 },
    ],
  },
  {
    type: "EXPENSE",
    key: "education",
    name: "教育学习",
    sortOrder: 70,
    children: [
      { key: "tuition", name: "学费课程", sortOrder: 10 },
      { key: "books", name: "书籍资料", sortOrder: 20 },
      { key: "other", name: "其他学习", sortOrder: 90 },
    ],
  },
  {
    type: "EXPENSE",
    key: "entertainment",
    name: "娱乐休闲",
    sortOrder: 80,
    children: [
      { key: "movie", name: "电影演出", sortOrder: 10 },
      { key: "game", name: "游戏", sortOrder: 20 },
      { key: "travel", name: "旅游", sortOrder: 30 },
      { key: "other", name: "其他娱乐", sortOrder: 90 },
    ],
  },
  {
    type: "EXPENSE",
    key: "social",
    name: "人情往来",
    sortOrder: 90,
    children: [
      { key: "gift", name: "礼金红包", sortOrder: 10 },
      { key: "party", name: "聚会", sortOrder: 20 },
      { key: "other", name: "其他人情", sortOrder: 90 },
    ],
  },
  { type: "EXPENSE", key: "other-expense", name: "其他支出", sortOrder: 100 },
  {
    type: "INCOME",
    key: "salary",
    name: "工资收入",
    sortOrder: 10,
    children: [
      { key: "salary", name: "工资", sortOrder: 10 },
      { key: "bonus", name: "奖金", sortOrder: 20 },
      { key: "allowance", name: "补贴", sortOrder: 30 },
    ],
  },
  {
    type: "INCOME",
    key: "business",
    name: "经营收入",
    sortOrder: 20,
    children: [
      { key: "business", name: "经营所得", sortOrder: 10 },
      { key: "labor", name: "劳务收入", sortOrder: 20 },
      { key: "other", name: "其他经营", sortOrder: 90 },
    ],
  },
  {
    type: "INCOME",
    key: "investment",
    name: "投资理财",
    sortOrder: 30,
    children: [
      { key: "interest", name: "利息", sortOrder: 10 },
      { key: "dividend", name: "分红", sortOrder: 20 },
      { key: "other", name: "其他投资", sortOrder: 90 },
    ],
  },
  {
    type: "INCOME",
    key: "reimbursement",
    name: "报销退款",
    sortOrder: 40,
    children: [
      { key: "reimbursement", name: "报销", sortOrder: 10 },
      { key: "refund", name: "退款", sortOrder: 20 },
      { key: "other", name: "其他返还", sortOrder: 90 },
    ],
  },
  {
    type: "INCOME",
    key: "social-income",
    name: "人情收入",
    sortOrder: 50,
    children: [
      { key: "gift", name: "礼金红包", sortOrder: 10 },
      { key: "other", name: "其他人情", sortOrder: 90 },
    ],
  },
  { type: "INCOME", key: "other-income", name: "其他收入", sortOrder: 100 },
];

interface DefaultIconMetadata {
  iconKey: string;
  color: string;
}

/** 图标键由服务端白名单维护，分类只保存稳定键，不保存组件名。 */
export const DEFAULT_ICON_METADATA: Readonly<
  Record<string, DefaultIconMetadata>
> = {
  "expense.food": { iconKey: "tabler:tools-kitchen-2", color: "#F97316" },
  "expense.food.breakfast": { iconKey: "tabler:egg-fried", color: "#F97316" },
  "expense.food.lunch": { iconKey: "tabler:bowl", color: "#F97316" },
  "expense.food.dinner": {
    iconKey: "tabler:tools-kitchen-2",
    color: "#F97316",
  },
  "expense.food.snacks": { iconKey: "tabler:cookie", color: "#F97316" },
  "expense.food.other": { iconKey: "tabler:dots", color: "#F97316" },
  "expense.transport": { iconKey: "tabler:bus", color: "#0EA5E9" },
  "expense.transport.public": { iconKey: "tabler:bus", color: "#0EA5E9" },
  "expense.transport.taxi": { iconKey: "tabler:taxi", color: "#0EA5E9" },
  "expense.transport.driving": { iconKey: "tabler:car", color: "#0EA5E9" },
  "expense.transport.long-distance": {
    iconKey: "tabler:route",
    color: "#0EA5E9",
  },
  "expense.shopping": { iconKey: "tabler:shopping-cart", color: "#EC4899" },
  "expense.shopping.daily": {
    iconKey: "tabler:shopping-bag",
    color: "#EC4899",
  },
  "expense.shopping.clothing": { iconKey: "tabler:shirt", color: "#EC4899" },
  "expense.shopping.digital": {
    iconKey: "tabler:device-mobile",
    color: "#EC4899",
  },
  "expense.shopping.other": { iconKey: "tabler:dots", color: "#EC4899" },
  "expense.housing": { iconKey: "tabler:home", color: "#8B5CF6" },
  "expense.housing.rent": { iconKey: "tabler:home-dollar", color: "#8B5CF6" },
  "expense.housing.utilities": { iconKey: "tabler:bolt", color: "#8B5CF6" },
  "expense.housing.property": { iconKey: "tabler:building", color: "#8B5CF6" },
  "expense.housing.repair": { iconKey: "tabler:tools", color: "#8B5CF6" },
  "expense.services": { iconKey: "tabler:tool", color: "#14B8A6" },
  "expense.services.telecom": { iconKey: "tabler:phone", color: "#14B8A6" },
  "expense.services.delivery": { iconKey: "tabler:package", color: "#14B8A6" },
  "expense.services.service": { iconKey: "tabler:scissors", color: "#14B8A6" },
  "expense.services.other": { iconKey: "tabler:dots", color: "#14B8A6" },
  "expense.health": { iconKey: "tabler:heart-pulse", color: "#EF4444" },
  "expense.health.medical": {
    iconKey: "tabler:medical-cross",
    color: "#EF4444",
  },
  "expense.health.medicine": { iconKey: "tabler:pill", color: "#EF4444" },
  "expense.health.fitness": { iconKey: "tabler:barbell", color: "#EF4444" },
  "expense.health.other": { iconKey: "tabler:dots", color: "#EF4444" },
  "expense.education": { iconKey: "tabler:book", color: "#6366F1" },
  "expense.education.tuition": { iconKey: "tabler:school", color: "#6366F1" },
  "expense.education.books": { iconKey: "tabler:books", color: "#6366F1" },
  "expense.education.other": { iconKey: "tabler:pencil", color: "#6366F1" },
  "expense.entertainment": { iconKey: "tabler:confetti", color: "#F59E0B" },
  "expense.entertainment.movie": { iconKey: "tabler:movie", color: "#F59E0B" },
  "expense.entertainment.game": {
    iconKey: "tabler:device-gamepad-2",
    color: "#F59E0B",
  },
  "expense.entertainment.travel": { iconKey: "tabler:plane", color: "#F59E0B" },
  "expense.entertainment.other": {
    iconKey: "tabler:mood-happy",
    color: "#F59E0B",
  },
  "expense.social": { iconKey: "tabler:users", color: "#F43F5E" },
  "expense.social.gift": { iconKey: "tabler:gift", color: "#F43F5E" },
  "expense.social.party": { iconKey: "tabler:cake", color: "#F43F5E" },
  "expense.social.other": { iconKey: "tabler:heart", color: "#F43F5E" },
  "expense.other-expense": { iconKey: "tabler:dots", color: "#64748B" },
  "income.salary": { iconKey: "tabler:briefcase", color: "#22C55E" },
  "income.salary.salary": { iconKey: "tabler:cash", color: "#22C55E" },
  "income.salary.bonus": { iconKey: "tabler:gift", color: "#22C55E" },
  "income.salary.allowance": { iconKey: "tabler:wallet", color: "#22C55E" },
  "income.business": { iconKey: "tabler:building-store", color: "#10B981" },
  "income.business.business": {
    iconKey: "tabler:shopping-bag",
    color: "#10B981",
  },
  "income.business.labor": { iconKey: "tabler:hammer", color: "#10B981" },
  "income.business.other": { iconKey: "tabler:receipt", color: "#10B981" },
  "income.investment": { iconKey: "tabler:chart-line", color: "#14B8A6" },
  "income.investment.interest": {
    iconKey: "tabler:percentage",
    color: "#14B8A6",
  },
  "income.investment.dividend": { iconKey: "tabler:coins", color: "#14B8A6" },
  "income.investment.other": { iconKey: "tabler:chart-bar", color: "#14B8A6" },
  "income.reimbursement": {
    iconKey: "tabler:receipt-refund",
    color: "#06B6D4",
  },
  "income.reimbursement.reimbursement": {
    iconKey: "tabler:receipt",
    color: "#06B6D4",
  },
  "income.reimbursement.refund": {
    iconKey: "tabler:arrow-back-up",
    color: "#06B6D4",
  },
  "income.reimbursement.other": { iconKey: "tabler:rotate", color: "#06B6D4" },
  "income.social-income": { iconKey: "tabler:heart", color: "#EC4899" },
  "income.social-income.gift": { iconKey: "tabler:gift", color: "#EC4899" },
  "income.social-income.other": { iconKey: "tabler:users", color: "#EC4899" },
  "income.other-income": { iconKey: "tabler:plus", color: "#16A34A" },
};

export function getDefaultCategoryData(ledgerId: string) {
  const data: Array<{
    id: string;
    ledgerId: string;
    type: CategoryType;
    name: string;
    parentId: string | null;
    sortOrder: number;
    isSystem: boolean;
    defaultKey: string;
    iconSource: "LIBRARY";
    iconKey: string;
    color: string;
  }> = [];

  for (const category of DEFAULT_CATEGORIES) {
    const parentCategoryId = randomUUID();
    const defaultKey = `${category.type === "EXPENSE" ? "expense" : "income"}.${category.key}`;
    const icon = DEFAULT_ICON_METADATA[defaultKey];
    if (!icon) throw new Error(`缺少默认分类图标映射: ${defaultKey}`);
    data.push({
      id: parentCategoryId,
      ledgerId,
      type: category.type,
      name: category.name,
      parentId: null,
      sortOrder: category.sortOrder,
      isSystem: true,
      defaultKey,
      iconSource: "LIBRARY",
      iconKey: icon.iconKey,
      color: icon.color,
    });
    for (const child of category.children ?? []) {
      const childDefaultKey = `${defaultKey}.${child.key}`;
      const childIcon = DEFAULT_ICON_METADATA[childDefaultKey];
      if (!childIcon)
        throw new Error(`缺少默认分类图标映射: ${childDefaultKey}`);
      data.push({
        id: randomUUID(),
        ledgerId,
        type: category.type,
        name: child.name,
        parentId: parentCategoryId,
        sortOrder: child.sortOrder,
        isSystem: true,
        defaultKey: childDefaultKey,
        iconSource: "LIBRARY",
        iconKey: childIcon.iconKey,
        color: childIcon.color,
      });
    }
  }
  return data;
}
