import * as React from 'react';
import {
  IconArrowBackUp,
  IconBarbell,
  IconBook,
  IconBooks,
  IconBolt,
  IconBowl,
  IconBriefcase,
  IconBuilding,
  IconBuildingStore,
  IconBus,
  IconCake,
  IconCash,
  IconCar,
  IconChartBar,
  IconChartLine,
  IconCoins,
  IconConfetti,
  IconCookie,
  IconDeviceGamepad2,
  IconDeviceMobile,
  IconDots,
  IconEggFried,
  IconGift,
  IconHammer,
  IconHeart,
  IconHeartbeat,
  IconHome,
  IconHomeDollar,
  IconMedicalCross,
  IconMoodHappy,
  IconPackage,
  IconPercentage,
  IconPaw,
  IconPhone,
  IconPill,
  IconPlane,
  IconReceipt,
  IconReceiptRefund,
  IconRoute,
  IconScissors,
  IconSchool,
  IconShoppingBag,
  IconShoppingCart,
  IconShirt,
  IconTool,
  IconTools,
  IconToolsKitchen2,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  isCategoryIconUrlUsable,
  normalizeCategoryIcon,
} from '@/lib/bill/category-icon';
import type { CategoryIconFields } from '@/lib/api/category-types';

export interface CategoryIconProps extends Partial<CategoryIconFields> {
  /** 分类名称；用于图片加载失败或未知图标的降级展示。 */
  name: string;
  /** 旧版后端字段。 */
  icon?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

type IconComponent = React.ComponentType<{
  size?: number | string;
  stroke?: number;
  className?: string;
}>;

/** 后端只保存稳定 key，前端显式维护白名单映射。 */
const LIBRARY_ICONS: Record<string, IconComponent> = {
  'tabler:arrow-back-up': IconArrowBackUp,
  'tabler:barbell': IconBarbell,
  'tabler:book': IconBook,
  'tabler:books': IconBooks,
  'tabler:bolt': IconBolt,
  'tabler:bowl': IconBowl,
  'tabler:briefcase': IconBriefcase,
  'tabler:building': IconBuilding,
  'tabler:building-store': IconBuildingStore,
  'tabler:bus': IconBus,
  'tabler:cake': IconCake,
  'tabler:cash': IconCash,
  'tabler:car': IconCar,
  'tabler:chart-bar': IconChartBar,
  'tabler:chart-line': IconChartLine,
  'tabler:coins': IconCoins,
  'tabler:confetti': IconConfetti,
  'tabler:cookie': IconCookie,
  'tabler:device-gamepad-2': IconDeviceGamepad2,
  'tabler:device-mobile': IconDeviceMobile,
  'tabler:dots': IconDots,
  'tabler:egg-fried': IconEggFried,
  'tabler:gift': IconGift,
  'tabler:hammer': IconHammer,
  'tabler:heart': IconHeart,
  'tabler:heart-pulse': IconHeartbeat,
  'tabler:home': IconHome,
  'tabler:home-dollar': IconHomeDollar,
  'tabler:medical-cross': IconMedicalCross,
  'tabler:package': IconPackage,
  'tabler:paw': IconPaw,
  'tabler:percentage': IconPercentage,
  'tabler:phone': IconPhone,
  'tabler:pill': IconPill,
  'tabler:plane': IconPlane,
  'tabler:receipt': IconReceipt,
  'tabler:receipt-refund': IconReceiptRefund,
  'tabler:route': IconRoute,
  'tabler:scissors': IconScissors,
  'tabler:school': IconSchool,
  'tabler:shopping-bag': IconShoppingBag,
  'tabler:shopping-cart': IconShoppingCart,
  'tabler:shirt': IconShirt,
  'tabler:taxi': IconCar,
  'tabler:tool': IconTool,
  'tabler:tools': IconTools,
  'tabler:tools-kitchen-2': IconToolsKitchen2,
  'tabler:users': IconUsers,
  'tabler:wallet': IconWallet,
};

const PALETTE = ['#ff6b5b', '#f2994a', '#f2c94c', '#6fcf97', '#56ccf2', '#9b8cf5', '#eb7ab8', '#8d9db6'];

function paletteFor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

const SIZE_CLASS = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
} as const;

const ICON_SIZE = { sm: 15, md: 19, lg: 23 } as const;

export function CategoryIcon({
  name,
  icon,
  iconSource,
  iconKey,
  iconAssetId,
  iconUrl,
  iconUrlExpiresAt,
  color,
  size = 'md',
  className,
}: CategoryIconProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = React.useState(false);
  const normalized = normalizeCategoryIcon({
    icon: icon ?? null,
    iconSource,
    iconKey,
    iconAssetId,
    iconUrl,
    iconUrlExpiresAt,
    color: color ?? null,
  });
  const imageUsable =
    !imageFailed &&
    normalized.source === 'IMAGE' &&
    isCategoryIconUrlUsable(normalized.url, normalized.urlExpiresAt);
  const LibraryIcon = normalized.source === 'LIBRARY' && normalized.key
    ? LIBRARY_ICONS[normalized.key]
    : undefined;
  const background = normalized.color ?? paletteFor(name);
  const initial = name.trim().slice(0, 1) || '账';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        SIZE_CLASS[size],
        className,
      )}
      style={{ backgroundColor: background }}
    >
      {imageUsable && normalized.url ? (
        <img
          src={normalized.url}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : LibraryIcon ? (
        <LibraryIcon size={ICON_SIZE[size]} stroke={1.8} />
      ) : (
        initial
      )}
    </span>
  );
}

export { LIBRARY_ICONS };
