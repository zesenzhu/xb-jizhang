import { ValidateBy } from 'class-validator';

export function isLedgerTimezone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value !== 'UTC' && !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;

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
