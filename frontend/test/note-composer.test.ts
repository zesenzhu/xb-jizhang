import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 键盘覆盖模型契约。
 *
 * 关键约束（三期需求 7.2）：
 * 1. 系统键盘不顶起面板，数字键盘保持原位被覆盖；
 * 2. 编辑条浮在键盘上缘，位置只由 keyboardInset 决定；
 * 3. 面板内的输入框不能被真正聚焦，否则原生键盘会顶起布局、iOS 还会放大页面。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const read = (relative: string): string => readFileSync(join(srcRoot, relative), 'utf8');

const dock = read('components/bill/NoteComposerDock.tsx');
const meta = read('components/bill/SheetMetaFields.tsx');
const sheet = read('components/ui/bottom-sheet.tsx');

// 1. 编辑条按键盘占位定位，且不自行改变面板高度。
assert.ok(
  /bottom: `\$\{keyboardInset \+ 8\}px`/.test(dock),
  '编辑条必须按 keyboardInset 贴住键盘上缘',
);
assert.ok(dock.includes('useVisualViewport'), '编辑条必须读取可视视口，而不是猜键盘高度');
assert.ok(dock.includes('createPortal'), '编辑条必须挂到 body，避免被面板 overflow 裁剪');
assert.ok(dock.includes('z-[65]'), '编辑条层级必须在面板之上、日期弹窗之下');
assert.ok(
  !/100dvh|100vh/.test(dock),
  '编辑条不得参与视口高度计算，否则会与覆盖模型冲突',
);

// 2. 关闭时不渲染任何节点，避免透明层拦截面板点击。
assert.ok(
  /if \(!open \|\| typeof document === 'undefined'\) return null;/.test(dock),
  '编辑条关闭时必须不渲染',
);

// 3. 候选只在备注字段出现；标题编辑不展示历史备注。
assert.ok(
  /\{field === 'note' && \(/.test(dock),
  '历史备注候选只在备注字段渲染',
);

// 4. 面板内输入框只读，点击后转交编辑条；否则会同时弹出系统键盘并顶起面板。
for (const field of ['title', 'note']) {
  const pattern = new RegExp(`(value=\\{${field}\\}[\\s\\S]{0,400}?readOnly)`);
  assert.ok(pattern.test(meta), `金额卡中的 ${field} 输入必须是只读触发器`);
}
assert.ok(
  /openComposer\('title'\)/.test(meta) && /openComposer\('note'\)/.test(meta),
  '点击商家/备注必须打开编辑条',
);
assert.ok(
  /onFocus=\{\(event\) => \{\s*event\.currentTarget\.blur\(\);/.test(meta),
  '输入框获得焦点时必须立即失焦，避免系统键盘顶起面板',
);

// 5. 时间胶囊先收起键盘再开弹窗，避免弹窗与键盘同屏。
assert.ok(
  /document\.activeElement instanceof HTMLElement\) document\.activeElement\.blur\(\)/.test(meta),
  '打开时间弹窗前必须收起系统键盘',
);
assert.ok(meta.includes('DateTimePickerDialog'), '时间必须走独立弹窗，而不是原生选择器');

// 6. 面板高度保持 100dvh 基准，不跟随 visualViewport 收缩。
assert.ok(
  /h-\[calc\(100dvh-1\.5rem\)\]/.test(sheet),
  '全屏面板必须保持 100dvh 基准高度',
);
assert.ok(
  !/--app-vv-height/.test(sheet),
  '面板不得按可视视口重算高度，否则会变成「顶起」模型',
);

console.log('note composer contract passed');
