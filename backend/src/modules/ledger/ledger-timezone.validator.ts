import { getTimeZones } from '@vvo/tzdb';
import { ValidateBy } from 'class-validator';

const ianaTimezoneNames = new Set(
  getTimeZones({ includeUtc: true, includeGmtOffsets: true }).flatMap((zone) => zone.group),
);

export function isLedgerTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !ianaTimezoneNames.has(value)) return false;

  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const IsLedgerTimezone = () =>
  ValidateBy({
    name: 'isLedgerTimezone',
    validator: {
      validate: isLedgerTimezone,
      defaultMessage: () => 'timezone must be an IANA time zone',
    },
  });
