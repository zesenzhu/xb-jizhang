import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 键盘覆盖与备注候选契约。
 *
 * 三期定稿的行为（需求 7.2）：
 * 1. 备注就在原位输入，不额外弹一层编辑框；
 * 2. 系统键盘弹出时面板不被顶起，底部区整体抬到键盘上缘；
 * 3. 历史备注候选浮在输入上方，点选只回填，不产生「完成备注」这类额外步骤；
 * 4. 数字键盘被系统键盘覆盖后不再占位，但提交动作必须仍然可达。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const read = (relative: string): string => readFileSync(join(srcRoot, relative), 'utf8');

// 1. 多余的备注编辑层已删除，不能再被重新引入。
assert.equal(
  existsSync(join(srcRoot, 'components/bill/NoteComposerDock.tsx')),
  false,
  '不得保留额外的备注编辑弹层',
);

const meta = read('components/bill/SheetMetaFields.tsx');
const body = read('components/bill/BillFormBody.tsx');
const bar = read('components/bill/NoteSuggestionBar.tsx');
const sheet = read('components/ui/bottom-sheet.tsx');

// 2. 备注在原位编辑：可编辑输入 + 候选浮在输入上方。
assert.ok(!meta.includes('NoteComposerDock'), '已删除的编辑条不得再被引用');
assert.ok(meta.includes('NoteSuggestionBar'), '备注必须使用历史候选栏');
assert.ok(
  meta.indexOf('showSuggestions') < meta.indexOf('placeholder="点击填写备注"'),
  '候选栏必须渲染在备注输入上方',
);
assert.ok(
  /const showSuggestions = noteFocused && suggestions\.length > 0;/.test(meta),
  '候选只在备注聚焦时出现，避免常驻占位',
);
assert.ok(
  /onMouseDown=\{keepFocus\}\s*onTouchStart=\{keepFocus\}/.test(meta),
  '点选候选时必须先阻止失焦，否则候选会在点击生效前消失',
);
assert.ok(
  !/onSubmit|onSave/.test(bar),
  '候选栏不得持有提交能力，点选只回填文本',
);

// 3. 键盘弹出时抬升底部区，而不是改面板高度。
assert.ok(
  body.includes('useVisualViewport'),
  '记账面板必须读取可视视口判断键盘状态',
);
assert.ok(
  /style=\{isKeyboardOpen \? \{ marginBottom: keyboardInset \} : undefined\}/.test(body),
  '底部区必须按 keyboardInset 抬到键盘上缘',
);
assert.ok(
  /h-\[calc\(100dvh-1\.5rem\)\]/.test(sheet) && !/--app-vv-height/.test(sheet),
  '面板必须保持 100dvh 基准，不随可视视口收缩',
);

// 4. 提交必须始终可达：键盘态渲染紧凑保存条，非键盘态用数字键盘。
assert.ok(
  /isKeyboardOpen \? \(/.test(body),
  '键盘态必须切换到紧凑保存条',
);
assert.ok(
  /保存中…/.test(body),
  '紧凑保存条需要提交中的反馈文案',
);
assert.ok(
  body.includes('AmountKeypad'),
  '非键盘态必须保留数字键盘',
);

// 5. 时间仍走独立弹窗，且打开前先收起键盘。
assert.ok(meta.includes('DateTimePickerDialog'), '时间必须走独立弹窗');
assert.ok(
  /document\.activeElement instanceof HTMLElement\) document\.activeElement\.blur\(\)/.test(meta),
  '打开时间弹窗前必须收起系统键盘',
);

console.log('note composer contract passed');
