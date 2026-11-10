import type { CategoryType } from '@prisma/client';

export const CATEGORY_ICON_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type CategoryIconMimeType =
  (typeof CATEGORY_ICON_ALLOWED_MIME_TYPES)[number];

export const DEFAULT_CATEGORY_ICON_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_CATEGORY_ICON_LEDGER_QUOTA_BYTES = 128 * 1024 * 1024;
export const DEFAULT_CATEGORY_ICON_UPLOAD_URL_TTL_SECONDS = 600;
export const DEFAULT_CATEGORY_ICON_READ_URL_TTL_SECONDS = 300;
export const DEFAULT_CATEGORY_ICON_ORPHAN_TTL_SECONDS = 24 * 60 * 60;
export const DEFAULT_CATEGORY_ICON_CLEANUP_INTERVAL_SECONDS = 600;
export const CATEGORY_ICON_FILE_HEADER_BYTES = 16;

export interface CategoryIconLibraryItem {
  key: string;
  label: string;
  aliases: string[];
  group: string;
  defaultTypes: CategoryType[];
}

function item(
  key: string,
  label: string,
  group: string,
  defaultTypes: CategoryType[],
  aliases: string[] = [],
): CategoryIconLibraryItem {
  return { key, label, aliases, group, defaultTypes };
}

/** 只维护稳定键，前端不得根据用户输入加载任意组件。 */
export const CATEGORY_ICON_LIBRARY: ReadonlyArray<CategoryIconLibraryItem> = [
  item(
    'tabler:tools-kitchen-2',
    '餐具',
    '餐饮',
    ['EXPENSE'],
    ['餐饮', 'food', 'kitchen'],
  ),
  item('tabler:egg-fried', '早餐', '餐饮', ['EXPENSE'], ['早餐', 'breakfast']),
  item('tabler:bowl', '午餐', '餐饮', ['EXPENSE'], ['午餐', 'lunch']),
  item('tabler:cookie', '零食', '餐饮', ['EXPENSE'], ['零食', 'snack']),
  item('tabler:coffee', '咖啡', '餐饮', ['EXPENSE'], ['咖啡', 'coffee']),
  item('tabler:bus', '公交', '交通', ['EXPENSE'], ['交通', '公交', 'bus']),
  item('tabler:taxi', '出租车', '交通', ['EXPENSE'], ['打车', 'taxi']),
  item('tabler:car', '汽车', '交通', ['EXPENSE'], ['自驾', 'car']),
  item('tabler:route', '路线', '交通', ['EXPENSE'], ['长途', 'route']),
  item(
    'tabler:plane',
    '飞机',
    '交通',
    ['EXPENSE'],
    ['旅行', 'travel', 'plane'],
  ),
  item(
    'tabler:shopping-cart',
    '购物车',
    '购物',
    ['EXPENSE'],
    ['购物', 'shopping'],
  ),
  item(
    'tabler:shopping-bag',
    '购物袋',
    '购物',
    ['EXPENSE'],
    ['日用品', 'shopping bag'],
  ),
  item('tabler:shirt', '服饰', '购物', ['EXPENSE'], ['服装', 'clothing']),
  item(
    'tabler:device-mobile',
    '手机',
    '购物',
    ['EXPENSE'],
    ['数码', 'digital', 'mobile'],
  ),
  item('tabler:home', '房屋', '居住', ['EXPENSE'], ['居住', 'home']),
  item('tabler:home-dollar', '房租', '居住', ['EXPENSE'], ['租房', 'rent']),
  item('tabler:bolt', '水电', '居住', ['EXPENSE'], ['水电燃气', 'utilities']),
  item('tabler:building', '建筑', '居住', ['EXPENSE'], ['物业', 'building']),
  item('tabler:tools', '维修工具', '生活服务', ['EXPENSE'], ['维修', 'repair']),
  item('tabler:tool', '工具', '生活服务', ['EXPENSE'], ['服务', 'service']),
  item(
    'tabler:scissors',
    '剪刀',
    '生活服务',
    ['EXPENSE'],
    ['理发', '服务', 'scissors'],
  ),
  item('tabler:phone', '电话', '生活服务', ['EXPENSE'], ['通讯', 'phone']),
  item('tabler:package', '包裹', '生活服务', ['EXPENSE'], ['快递', 'delivery']),
  item(
    'tabler:heart-pulse',
    '健康',
    '医疗健康',
    ['EXPENSE'],
    ['医疗', 'health'],
  ),
  item(
    'tabler:medical-cross',
    '医疗十字',
    '医疗健康',
    ['EXPENSE'],
    ['医疗', 'medical'],
  ),
  item('tabler:pill', '药片', '医疗健康', ['EXPENSE'], ['药品', 'medicine']),
  item('tabler:barbell', '哑铃', '医疗健康', ['EXPENSE'], ['运动', 'fitness']),
  item(
    'tabler:book',
    '书本',
    '教育学习',
    ['EXPENSE'],
    ['学习', '教育', 'book'],
  ),
  item('tabler:school', '学校', '教育学习', ['EXPENSE'], ['学校', 'school']),
  item('tabler:books', '书籍', '教育学习', ['EXPENSE'], ['书籍', 'books']),
  item('tabler:pencil', '铅笔', '教育学习', ['EXPENSE'], ['资料', 'pencil']),
  item(
    'tabler:confetti',
    '彩纸',
    '娱乐休闲',
    ['EXPENSE'],
    ['娱乐', '休闲', 'confetti'],
  ),
  item('tabler:movie', '电影', '娱乐休闲', ['EXPENSE'], ['电影', 'movie']),
  item(
    'tabler:device-gamepad-2',
    '游戏手柄',
    '娱乐休闲',
    ['EXPENSE'],
    ['游戏', 'game'],
  ),
  item('tabler:mood-happy', '开心', '娱乐休闲', ['EXPENSE'], ['休闲', 'happy']),
  item(
    'tabler:users',
    '多人',
    '人情往来',
    ['EXPENSE', 'INCOME'],
    ['人情', '成员', 'users'],
  ),
  item(
    'tabler:gift',
    '礼物',
    '人情往来',
    ['EXPENSE', 'INCOME'],
    ['礼金', '红包', 'gift'],
  ),
  item('tabler:cake', '蛋糕', '人情往来', ['EXPENSE'], ['聚会', 'party']),
  item('tabler:heart', '爱心', '人情往来', ['EXPENSE', 'INCOME'], ['heart']),
  item(
    'tabler:briefcase',
    '公文包',
    '收入',
    ['INCOME'],
    ['工资', 'salary', 'work'],
  ),
  item('tabler:cash', '现金', '收入', ['INCOME'], ['收入', 'cash']),
  item('tabler:wallet', '钱包', '收入', ['INCOME'], ['补贴', 'wallet']),
  item(
    'tabler:building-store',
    '商店',
    '收入',
    ['INCOME'],
    ['经营', 'business'],
  ),
  item('tabler:hammer', '锤子', '收入', ['INCOME'], ['劳务', 'labor']),
  item('tabler:receipt', '收据', '收入', ['INCOME'], ['报销', 'receipt']),
  item(
    'tabler:chart-line',
    '趋势图',
    '收入',
    ['INCOME'],
    ['投资', '理财', 'chart'],
  ),
  item(
    'tabler:percentage',
    '百分比',
    '收入',
    ['INCOME'],
    ['利息', 'percentage'],
  ),
  item('tabler:coins', '硬币', '收入', ['INCOME'], ['分红', 'coins']),
  item('tabler:chart-bar', '柱状图', '收入', ['INCOME'], ['收益', 'chart']),
  item(
    'tabler:receipt-refund',
    '退款收据',
    '收入',
    ['INCOME'],
    ['报销退款', 'refund'],
  ),
  item('tabler:arrow-back-up', '返还', '收入', ['INCOME'], ['退款', 'return']),
  item('tabler:rotate', '循环', '收入', ['INCOME'], ['返还', 'rotate']),
  item('tabler:plus', '加号', '其他', ['EXPENSE', 'INCOME'], ['其他', 'plus']),
  item('tabler:dots', '更多', '其他', ['EXPENSE', 'INCOME'], ['其他', 'more']),
];

const categoryIconLibraryKeys = new Set(
  CATEGORY_ICON_LIBRARY.map((icon) => icon.key),
);

export function isCategoryIconLibraryKey(value: string): boolean {
  return categoryIconLibraryKeys.has(value);
}

export function getExtensionForCategoryIcon(
  mimeType: CategoryIconMimeType,
): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}
