import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SUMMARY_BACKGROUND,
  SKIN_IMAGE_MAX_BYTES,
  SKIN_THEME_OPTIONS,
  isHexColor,
  normalizeHexColor,
  resolveSummarySurface,
  validateSkinImage,
} from '../src/lib/skin/skin';
import { isLocalImageStorageSupported } from '../src/lib/skin/local-image';

/**
 * 皮肤：主题色 + 总支出卡片背景。
 *
 * 两条硬约束：
 * 1. 本地图片绝不上传，皮肤模块不得出现任何网络调用；
 * 2. 图片模式的白色文字必须靠暗色叠层保证可读，不能直接铺原图。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const read = (relative: string): string => readFileSync(join(srcRoot, relative), 'utf8');

// 颜色校验：只接受 #rgb / #rrggbb，避免把非法值写进 style。
assert.equal(isHexColor('#0a84ff'), true);
assert.equal(isHexColor('#abc'), true);
assert.equal(isHexColor('rgb(10, 132, 255)'), false);
assert.equal(isHexColor('#gggggg'), false);
assert.equal(isHexColor(''), false);

assert.equal(normalizeHexColor('#ABC'), '#aabbcc');
assert.equal(normalizeHexColor('  #0A84FF  '), '#0a84ff');
assert.equal(normalizeHexColor('blue'), null);

// 主题模式：用主色做渐变，不能是原来的死黑纯色。
const themeSurface = resolveSummarySurface({ background: { kind: 'theme' } });
assert.equal(themeSurface.backgroundColor, '#101319');
assert.ok(themeSurface.backgroundImage?.includes('radial-gradient'));
assert.ok(themeSurface.backgroundImage?.includes('var(--theme-primary)'));

// 纯色模式：非法颜色回退到安全底色，不抛错也不写坏样式。
assert.equal(
  resolveSummarySurface({ background: { kind: 'color', color: '#10B981' } }).backgroundColor,
  '#10b981',
);
assert.equal(
  resolveSummarySurface({ background: { kind: 'color', color: 'not-a-color' } }).backgroundColor,
  '#16181d',
);

// 图片模式：必须同时有暗色叠层和图片地址。
const imageSurface = resolveSummarySurface({
  background: { kind: 'image', imageKey: 'k1' },
  imageUrl: 'blob:https://example/1',
});
assert.ok(imageSurface.backgroundImage?.includes('linear-gradient'));
assert.ok(imageSurface.backgroundImage?.includes('url("blob:https://example/1")'));

// 图片还没读出来时回退主题背景，避免卡片瞬间变白。
const pendingImage = resolveSummarySurface({
  background: { kind: 'image', imageKey: 'k1' },
  imageUrl: null,
});
assert.deepEqual(pendingImage, themeSurface);

// 上传校验：类型、大小、空文件。
assert.deepEqual(validateSkinImage({ type: 'image/png', size: 1024 }), { ok: true });
assert.deepEqual(validateSkinImage({ type: 'image/svg+xml', size: 1024 }), {
  ok: false,
  reason: 'type',
});
assert.deepEqual(validateSkinImage({ type: 'text/html', size: 10 }), {
  ok: false,
  reason: 'type',
});
assert.deepEqual(validateSkinImage({ type: 'image/jpeg', size: SKIN_IMAGE_MAX_BYTES + 1 }), {
  ok: false,
  reason: 'size',
});
assert.deepEqual(validateSkinImage({ type: 'image/jpeg', size: 0 }), {
  ok: false,
  reason: 'empty',
});

// 默认值：跟随主题，且主题列表覆盖四个预设。
assert.deepEqual(DEFAULT_SUMMARY_BACKGROUND, { kind: 'theme' });
assert.deepEqual(
  SKIN_THEME_OPTIONS.map((option) => option.id),
  ['default', 'mint', 'amber', 'dark'],
);

// 无 IndexedDB 的环境必须安全降级，而不是抛错。
assert.equal(isLocalImageStorageSupported(), false);

// 契约：皮肤相关模块不得发起任何网络请求，图片只能留在本机。
for (const relative of [
  'lib/skin/local-image.ts',
  'lib/skin/skin-store.ts',
  'components/skin/use-summary-surface.ts',
  'components/skin/AppearancePage.tsx',
]) {
  const content = read(relative);
  assert.ok(!/from '@\/lib\/api/.test(content), `${relative} 不得引入接口层`);
  assert.ok(!/fetch\(/.test(content), `${relative} 不得发起 fetch`);
  assert.ok(!/userClient/.test(content), `${relative} 不得使用 userClient`);
}

// 卡片必须真的使用皮肤表面，而不是继续写死黑色。
const card = read('components/bill/MonthSummaryCard.tsx');
assert.ok(card.includes('useSummarySurface'));
assert.ok(card.includes('style={surface}'));
assert.ok(!/bg-\[#16181d\]/.test(card), '总支出卡片不得写死黑色背景');

console.log('skin contract passed');
