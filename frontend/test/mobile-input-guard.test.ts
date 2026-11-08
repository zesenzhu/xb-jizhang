import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 移动端输入字号与视口护栏。
 *
 * iOS Safari 在聚焦字号小于 16px 的控件时会强制放大页面，且不总是还原，
 * 这是「记账时整个应用被放大」的根因。护栏必须长期存在，不能靠组件各写一份。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const read = (relative: string): string => readFileSync(join(srcRoot, relative), 'utf8');

const css = read('app/globals.css');

// 1. 全局兜底：移动端表单控件不小于 16px。
assert.ok(
  /@media \(max-width: 768px\) \{[\s\S]*?font-size: 16px;[\s\S]*?\}/.test(css),
  'globals.css 必须保留移动端 16px 字号护栏',
);
assert.ok(
  /input,\s*\n\s*textarea,\s*\n\s*select/.test(css),
  '护栏必须覆盖 input、textarea 和 select',
);

// 2. 布局视口不得通过禁止缩放来掩盖问题，只声明键盘交互模式。
const layout = read('app/layout.tsx');
assert.ok(
  layout.includes("interactiveWidget: 'resizes-visual'"),
  '必须声明 resizes-visual，让键盘压缩可视视口而不是放大页面',
);
assert.ok(
  !/userScalable:\s*false|maximumScale/.test(layout),
  '不得禁用系统缩放，保留辅助功能',
);

// 3. 记账链路上的可聚焦输入使用 16px，不允许回退到 text-xs。
const focusableFiles = [
  'components/bill/NoteComposerDock.tsx',
  'components/bill/SheetMetaFields.tsx',
];
for (const relative of focusableFiles) {
  const content = read(relative);
  const focusableTags = content.match(/<(input|textarea)[\s\S]*?\/>/g) ?? [];
  assert.ok(focusableTags.length > 0, `${relative} 必须包含可聚焦输入`);
  for (const tag of focusableTags) {
    assert.ok(
      !/text-xs/.test(tag),
      `${relative} 的可聚焦输入不得使用 text-xs`,
    );
  }
  assert.ok(
    /text-base/.test(content),
    `${relative} 的输入必须显式使用 text-base`,
  );
}

// 4. 备注候选 chip 属于可点击元素，不承载输入，允许小字号但要可点。
const bar = read('components/bill/NoteSuggestionBar.tsx');
assert.ok(/px-2\.5 py-1/.test(bar), '候选 chip 需要足够的点击面积');

console.log('mobile input guard contract passed');
