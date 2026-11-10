import type {
  CategoryIconFields,
  CategoryIconSource,
  CategorySummary,
} from '@/lib/api/category-types';

export const CATEGORY_ICON_MAX_BYTES = 2 * 1024 * 1024;
export const CATEGORY_ICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type NormalizedCategoryIcon = {
  source: CategoryIconSource;
  key: string | null;
  assetId: string | null;
  url: string | null;
  urlExpiresAt: string | null;
  color: string | null;
};

/**
 * 统一第五期字段和旧版 `icon` 字段，页面只消费这个结果。
 * 服务端字段组合异常时按安全降级处理，不把任意字符串当作组件名。
 */
export function normalizeCategoryIcon(
  value: Pick<CategorySummary, 'color'> & Partial<Pick<CategorySummary, 'icon'> & CategoryIconFields>,
): NormalizedCategoryIcon {
  const source = value.iconSource ?? inferLegacySource(value.icon ?? null);
  const key = source === 'LIBRARY' ? value.iconKey ?? legacyLibraryKey(value.icon ?? null) : null;
  const assetId = source === 'IMAGE' ? value.iconAssetId ?? null : null;
  const url = source === 'IMAGE' ? value.iconUrl ?? null : null;
  const urlExpiresAt = source === 'IMAGE' ? value.iconUrlExpiresAt ?? null : null;

  if (source === 'LIBRARY' && !key) {
    return emptyIcon(value.color ?? null);
  }
  if (source === 'IMAGE' && !assetId) {
    return emptyIcon(value.color ?? null);
  }

  return { source, key, assetId, url, urlExpiresAt, color: value.color ?? null };
}

function inferLegacySource(icon: string | null): CategoryIconSource {
  return legacyLibraryKey(icon) ? 'LIBRARY' : 'NONE';
}

function legacyLibraryKey(icon: string | null): string | null {
  return icon?.startsWith('tabler:') ? icon : null;
}

function emptyIcon(color: string | null): NormalizedCategoryIcon {
  return {
    source: 'NONE',
    key: null,
    assetId: null,
    url: null,
    urlExpiresAt: null,
    color: color ?? null,
  };
}

export function isCategoryIconUrlUsable(
  url: string | null | undefined,
  expiresAt: string | null | undefined,
  now = Date.now(),
): url is string {
  if (!url || !expiresAt) return false;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > now + 5_000;
}

export type CategoryIconFileError = 'TYPE' | 'SIZE' | null;

export function validateCategoryIconFile(file: Pick<File, 'type' | 'size'>): CategoryIconFileError {
  if (!(CATEGORY_ICON_MIME_TYPES as readonly string[]).includes(file.type)) return 'TYPE';
  if (file.size <= 0 || file.size > CATEGORY_ICON_MAX_BYTES) return 'SIZE';
  return null;
}

export function categoryIconFileErrorMessage(error: CategoryIconFileError): string | null {
  if (error === 'TYPE') return '仅支持 PNG、JPEG 或 WebP 图片';
  if (error === 'SIZE') return '图片大小不能超过 2MB';
  return null;
}

export function categoryIconPayload(icon: NormalizedCategoryIcon): {
  iconSource: CategoryIconSource;
  iconKey: string | null;
  iconAssetId: string | null;
  color: string | null;
} {
  return {
    iconSource: icon.source,
    iconKey: icon.source === 'LIBRARY' ? icon.key : null,
    iconAssetId: icon.source === 'IMAGE' ? icon.assetId : null,
    color: icon.color,
  };
}
