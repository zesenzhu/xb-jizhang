import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 移动端聚焦放大护栏。
 *
 * iOS Safari 在聚焦字号小于 16px 的控件时会自动放大页面。本项目不改字号，
 * 改用 viewport 的 `maximumScale: 1` 抑制这次自动缩放，因此这里锁两件事：
 * 1. 视口仍声明 maximum-scale，且没有靠 `user-scalable=no` 一刀切禁用缩放；
 * 2. 没有任何全局规则再把表单控件字号强改成 16px，破坏既有排版。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const read = (relative: string): string => readFileSync(join(srcRoot, relative), 'utf8');

const layout = read('app/layout.tsx');
assert.ok(
  /maximumScale:\s*1/.test(layout),
  'layout.tsx 必须声明 maximumScale: 1，否则 iOS 聚焦小字号输入框仍会放大',
);
assert.ok(
  layout.includes("interactiveWidget: 'resizes-visual'"),
  '必须声明 resizes-visual，让键盘压缩可视视口而不是放大页面',
);
assert.ok(
  !/userScalable:\s*false/.test(layout),
  '不得用 user-scalable=no 一刀切禁用缩放',
);

const css = read('app/globals.css');
assert.ok(
  !/@media \(max-width: 768px\) \{[\s\S]{0,200}?font-size: 16px/.test(css),
  'globals.css 不得再全局强改 16px 字号',
);
assert.ok(
  /maximumScale|maximum-scale/.test(css),
  'globals.css 需要注明放大问题由 viewport 的 maximum-scale 处理',
);

// 输入框保持设计字号，且必须是可编辑的原生输入，不再走只读触发器。
const meta = read('components/bill/SheetMetaFields.tsx');
assert.ok(/text-xs/.test(meta), '金额卡输入必须保持设计字号 text-xs');
assert.ok(!/text-base/.test(meta), '不得为了规避放大把输入改成 16px');
assert.ok(!/readOnly/.test(meta), '输入必须可编辑，不应再使用只读触发器');
assert.ok(
  !/text-xs/.test(meta) === false && /onChange=/.test(meta),
  '可聚焦输入必须由受控 value + onChange 驱动',
);

console.log('mobile zoom guard contract passed');
