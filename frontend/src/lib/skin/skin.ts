/**
 * 皮肤外观：主题色、总支出卡片背景（纯色或本地图片）。
 *
 * 图片只存在浏览器本地（IndexedDB），从不上传服务端，也不进入任何接口请求。
 * 换设备、清缓存后需要重新选择，这是刻意取舍：避免把私人图片传到服务器。
 */

export type SkinThemeId = 'default' | 'mint' | 'amber' | 'dark';

export interface SkinThemeOption {
  id: SkinThemeId;
  label: string;
  /** 预览用的主色；与 globals.css 的 data-theme 变量保持一致 */
  swatch: string;
}

export const SKIN_THEME_OPTIONS: readonly SkinThemeOption[] = [
  { id: 'default', label: '科技蓝', swatch: '#0a84ff' },
  { id: 'mint', label: '薄荷绿', swatch: '#10b981' },
  { id: 'amber', label: '暖琥珀', swatch: '#f59e0b' },
  { id: 'dark', label: '深色', swatch: '#0a84ff' },
] as const;

export type SummaryBackground =
  | { kind: 'theme' }
  | { kind: 'color'; color: string }
  | { kind: 'image'; imageKey: string };

export const DEFAULT_SUMMARY_BACKGROUND: SummaryBackground = { kind: 'theme' };

/** 总支出卡片可选的自定义底色，避免用户选出与浅色文字冲突的极端值。 */
export const SUMMARY_COLOR_PRESETS: readonly string[] = [
  '#16181d',
  '#1f2937',
  '#0a84ff',
  '#10b981',
  '#f59e0b',
  '#7c3aed',
] as const;

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

/** 把 #rgb 归一化成 #rrggbb，便于与 rgba() 叠加计算。 */
export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

/**
 * 由背景设置推导卡片的样式。
 *
 * 图片模式必须叠一层暗色渐变：用户图片明暗不可控，不叠遮罩会让白色文字在浅色照片上完全看不清。
 */
export interface SummarySurface {
  backgroundColor: string;
  backgroundImage?: string;
}

export function resolveSummarySurface(input: {
  background: SummaryBackground;
  imageUrl?: string | null;
  /** 主题色用于渐变，取 CSS 变量值即可 */
  themeColor?: string;
}): SummarySurface {
  const themeColor = input.themeColor ?? 'var(--theme-primary)';

  if (input.background.kind === 'color') {
    const normalized = normalizeHexColor(input.background.color) ?? '#16181d';
    return { backgroundColor: normalized };
  }

  if (input.background.kind === 'image' && input.imageUrl) {
    return {
      backgroundColor: '#16181d',
      backgroundImage: `linear-gradient(180deg, rgba(12,14,18,0.35) 0%, rgba(12,14,18,0.82) 100%), url("${input.imageUrl}")`,
    };
  }

  // 主题模式：用主色做低饱和渐变，替换原来的纯黑，避免整块死黑。
  return {
    backgroundColor: '#101319',
    backgroundImage: `radial-gradient(120% 120% at 12% 0%, color-mix(in srgb, ${themeColor} 42%, transparent) 0%, transparent 62%)`,
  };
}

/** 仅允许图片类型，限制 6MB，避免把超大图塞进 IndexedDB。 */
export const SKIN_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
export const SKIN_IMAGE_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateSkinImage(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; reason: 'type' | 'size' | 'empty' } {
  if (file.size <= 0) return { ok: false, reason: 'empty' };
  if (!SKIN_IMAGE_MIME_ALLOWLIST.includes(file.type as (typeof SKIN_IMAGE_MIME_ALLOWLIST)[number])) {
    return { ok: false, reason: 'type' };
  }
  if (file.size > SKIN_IMAGE_MAX_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}
