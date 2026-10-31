import assert from 'node:assert/strict';
import { resolveInitialLedgerId, validateLedgerName } from '../src/lib/ledger/ledger-form';

const ledgers = [
  { id: 'ledger-1' },
  { id: 'ledger-2' },
] as Array<{ id: string }>;

assert.equal(validateLedgerName('家庭账本'), null);
assert.equal(validateLedgerName('  家庭账本  '), null);
assert.equal(validateLedgerName('   '), '请输入账本名称');
assert.equal(validateLedgerName(''), '请输入账本名称');
assert.equal(resolveInitialLedgerId(ledgers, 'ledger-2'), 'ledger-2');
assert.equal(resolveInitialLedgerId(ledgers, 'missing'), 'ledger-1');
assert.equal(resolveInitialLedgerId([], null), null);

console.log('ledger form contract passed');
