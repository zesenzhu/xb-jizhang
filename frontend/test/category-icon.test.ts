import assert from 'node:assert/strict';
import {
  categoryIconFileErrorMessage,
  categoryIconPayload,
  isCategoryIconUrlUsable,
  normalizeCategoryIcon,
  validateCategoryIconFile,
} from '../src/lib/bill/category-icon';

const now = Date.parse('2026-11-10T08:00:00.000Z');

assert.deepEqual(
  normalizeCategoryIcon({
    icon: null,
    iconSource: 'LIBRARY',
    iconKey: 'tabler:wallet',
    iconAssetId: null,
    color: '#22C55E',
  }),
  {
    source: 'LIBRARY',
    key: 'tabler:wallet',
    assetId: null,
    url: null,
    urlExpiresAt: null,
    color: '#22C55E',
  },
);

assert.equal(
  normalizeCategoryIcon({ icon: 'tabler:bus', color: null }).key,
  'tabler:bus',
);
assert.equal(
  normalizeCategoryIcon({ icon: 'some-untrusted-string', color: null }).source,
  'NONE',
);
assert.equal(
  normalizeCategoryIcon({
    icon: null,
    iconSource: 'NONE',
    iconKey: 'tabler:wallet',
    iconAssetId: 'asset-1',
    color: null,
  }).key,
  null,
);

assert.equal(
  normalizeCategoryIcon({
    icon: null,
    iconSource: 'IMAGE',
    iconAssetId: 'asset-1',
    iconUrl: 'https://oss.example/icon.png',
    iconUrlExpiresAt: '2026-11-10T08:01:00.000Z',
    color: null,
  }).source,
  'IMAGE',
);
assert.equal(isCategoryIconUrlUsable('https://oss.example/icon.png', '2026-11-10T08:01:00.000Z', now), true);
assert.equal(isCategoryIconUrlUsable('https://oss.example/icon.png', '2026-11-10T08:00:01.000Z', now), false);
assert.equal(isCategoryIconUrlUsable('https://oss.example/icon.png', 'invalid', now), false);

assert.equal(validateCategoryIconFile({ type: 'image/png', size: 1024 }), null);
assert.equal(validateCategoryIconFile({ type: 'image/svg+xml', size: 1024 }), 'TYPE');
assert.equal(validateCategoryIconFile({ type: 'image/png', size: 2 * 1024 * 1024 + 1 }), 'SIZE');
assert.equal(categoryIconFileErrorMessage('TYPE'), '仅支持 PNG、JPEG 或 WebP 图片');

assert.deepEqual(
  categoryIconPayload({
    source: 'IMAGE',
    key: 'tabler:wallet',
    assetId: 'asset-1',
    url: null,
    urlExpiresAt: null,
    color: '#fff',
  }),
  { iconSource: 'IMAGE', iconKey: null, iconAssetId: 'asset-1', color: '#fff' },
);

console.log('category icon contract passed');
