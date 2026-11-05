import assert from 'node:assert/strict';
import { resolveInitialLedgerId, validateLedgerName } from '../src/lib/ledger/ledger-form';

const ledgers = [
  { id: 'ledger-1', isCurrent: false },
  { id: 'ledger-2', isCurrent: true },
] as Array<{ id: string; isCurrent: boolean }>;

assert.equal(validateLedgerName('家庭账本'), null);
assert.equal(validateLedgerName('  家庭账本  '), null);
assert.equal(validateLedgerName('   '), '请输入账本名称');
assert.equal(validateLedgerName(''), '请输入账本名称');
// 本地已选（仍在可访问列表里）优先。
assert.equal(resolveInitialLedgerId(ledgers, 'ledger-2'), 'ledger-2');
assert.equal(resolveInitialLedgerId(ledgers, 'ledger-1'), 'ledger-1');

// 本地为空或已失效时按服务端偏好走：换设备进站要用用户上次选的账本，
// 而不是列表第一本。
assert.equal(resolveInitialLedgerId(ledgers, 'missing'), 'ledger-2');
assert.equal(resolveInitialLedgerId(ledgers, null), 'ledger-2');

// 服务端没有标记当前账本时退回列表第一本。
assert.equal(
  resolveInitialLedgerId([{ id: 'ledger-1', isCurrent: false }], null),
  'ledger-1',
);
assert.equal(resolveInitialLedgerId([], null), null);

console.log('ledger form contract passed');
