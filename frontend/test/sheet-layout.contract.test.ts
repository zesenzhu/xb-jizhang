import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 抽屉布局契约。
 *
 * 背景：`BottomSheet` 面板本身是 `overflow-hidden` + `max-h-[88vh]`，
 * 正文如果不同时承担滚动，内容超过上限时会被直接裁切——底部按钮永远不可见，
 * 且横向内边距和 Home Indicator 留白一起丢失。新建/复制账本抽屉曾因此
 * 出现「表单左右贴边、取消/创建按钮被裁一半」。
 *
 * 这里锁两件事：
 * 1. 共享常量必须含滚动与安全区所需的工具类（单一来源，改错立即失败）；
 * 2. 抽屉组件内不得再出现无滚动的正文容器写法。
 */

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const sheetModule = readFileSync(join(srcRoot, 'components/ui/bottom-sheet.tsx'), 'utf8');

const bodyScrollMatch = sheetModule.match(/export const SHEET_BODY_SCROLL =\s*'([^']+)'/);
const footerMatch = sheetModule.match(/export const SHEET_FOOTER =\s*'([^']+)'/);

assert.ok(bodyScrollMatch, 'SHEET_BODY_SCROLL 必须导出');
assert.ok(footerMatch, 'SHEET_FOOTER 必须导出');

const bodyScroll = bodyScrollMatch[1];
const footer = footerMatch[1];

for (const util of ['min-h-0', 'flex-1', 'overflow-y-auto', 'px-4']) {
  assert.ok(bodyScroll.includes(util), `SHEET_BODY_SCROLL 缺少 ${util}`);
}
assert.ok(
  footer.includes('shrink-0') && footer.includes('env(safe-area-inset-bottom)'),
  'SHEET_FOOTER 必须固定高度并避开底部安全区',
);

/** 递归收集抽屉组件文件。 */
function collectSheetFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSheetFiles(path));
      continue;
    }
    if (!entry.name.endsWith('.tsx') || entry.name === 'bottom-sheet.tsx') continue;
    const content = readFileSync(path, 'utf8');
    if (content.includes('<BottomSheet')) files.push(path);
  }
  return files;
}

const sheetFiles = collectSheetFiles(join(srcRoot, 'components'));
assert.ok(sheetFiles.length > 0, '必须能找到抽屉组件');

/**
 * 允许委托：这些容器自己不写正文，把内容交给 `BillFormBody` / `BillDetailSheet`
 * 等已带滚动区的子组件。契约在子组件处成立，不能算违规。
 */
const DELEGATING_SHEETS = ['BillCreateSheet.tsx', 'BillDetailContainer.tsx'];

const offenders: string[] = [];
for (const file of sheetFiles) {
  if (DELEGATING_SHEETS.some((name) => file.endsWith(name))) continue;
  const content = readFileSync(file, 'utf8');
  const usesSharedBody = /SHEET_BODY_SCROLL(_ALONE)?/.test(content);
  // bill 系列把顶部工具栏和正文拆开处理，自己写 overflow-y-auto 同样合规。
  const hasOwnScrollBody = /overflow-y-auto|overflow-visible|sticky bottom-0/.test(content);
  if (!usesSharedBody && !hasOwnScrollBody) offenders.push(file);
}

assert.deepEqual(offenders, [], `抽屉正文缺少滚动容器：${offenders.join(', ')}`);

// 已修复的抽屉必须走共享常量，避免再次各写一份。
for (const relative of [
  'components/ledger/CreateLedgerSheet.tsx',
  'components/ledger/EditLedgerSheet.tsx',
  'components/ledger/CurrencySheet.tsx',
  'components/ledger/DeleteLedgerConfirm.tsx',
  'components/member/InviteMemberSheet.tsx',
  'components/member/TransferOwnerSheet.tsx',
  'components/member/MemberActionSheet.tsx',
  'components/ledger/LedgerActionSheet.tsx',
]) {
  const content = readFileSync(join(srcRoot, relative), 'utf8');
  assert.ok(content.includes('SHEET_BODY_SCROLL'), `${relative} 必须使用 SHEET_BODY_SCROLL`);
}

console.log('sheet layout contract passed');
