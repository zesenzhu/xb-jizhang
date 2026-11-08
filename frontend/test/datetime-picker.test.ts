import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  composeLocalDateTime,
  daysInMonth,
  parseLocalDateTime,
} from '../src/lib/bill/datetime-picker';
import { zonedDateTimeInputToIso, zonedInputValue } from '../src/lib/bill/timezone';

assert.equal(daysInMonth(2024, 2), 29);
assert.equal(daysInMonth(2026, 2), 28);
assert.equal(buildMonthGrid(2026, 11).length, 42);
assert.deepEqual(parseLocalDateTime('2026-11-08T19:05'), {
  year: 2026,
  month: 11,
  day: 8,
  hour: 19,
  minute: 5,
});
assert.equal(parseLocalDateTime('2026-02-30T19:05'), null);
assert.equal(composeLocalDateTime({ year: 2026, month: 11, day: 8, hour: 9, minute: 5 }), '2026-11-08T09:05');
assert.equal(composeLocalDateTime({ year: 2026, month: 2, day: 30, hour: 9, minute: 5 }), null);
assert.equal(zonedInputValue('2026-11-08T11:05:00.000Z'), '2026-11-08T19:05');
assert.equal(zonedDateTimeInputToIso('2026-11-08T19:05'), '2026-11-08T11:05:00.000Z');
assert.equal(zonedDateTimeInputToIso('2026-02-30T19:05'), '');

console.log('datetime picker contract passed');
