/**
 * Convert a UTC instant to a YYYY-MM-DD key in the given IANA timezone.
 */
export function toLocalDateKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** YYYY-MM from a UTC instant in the given timezone. */
export function toLocalMonthKey(date: Date, timezone: string): string {
  return toLocalDateKey(date, timezone).slice(0, 7);
}

/** Common IANA timezones for settings dropdown. */
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Helsinki',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
] as const;

/** ISO 4217 currencies supported in settings/import. */
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF', 'SGD',
] as const;

export type CalendarDayBasis = 'entry' | 'exit';

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}
