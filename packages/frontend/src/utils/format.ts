/**
 * Format utilities — currency-aware when currency code is provided.
 */

function formatCurrencyValue(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function fmtNumber(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Format currency value (no symbol), e.g. "1,234.56" */
export function fmtCurrency(value: number | null | undefined, decimals = 2): string {
  return fmtNumber(value, decimals);
}

/**
 * Signed currency with dynamic ISO symbol.
 * @param currency ISO 4217 code, default USD
 */
export function fmtSignedCurrency(
  value: number | null | undefined,
  currency = 'USD',
  decimals = 2,
): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return formatCurrencyValue(0, currency);
  const abs = Math.abs(n);
  const formatted = formatCurrencyValue(abs, currency);
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted.replace(/^-/, '')}`;
  return formatted;
}

/** Plain currency with symbol, e.g. "$1,234.56" or "¥1,234.56" */
export function fmtDollar(value: number | null | undefined, currency = 'USD', decimals = 2): string {
  void decimals;
  return formatCurrencyValue(Number(value ?? 0), currency);
}

/** @deprecated Use fmtDollar(value, currency) — kept for backward compatibility */
export function fmtDollarLegacy(value: number | null | undefined, decimals = 2): string {
  return `$${fmtNumber(value, decimals)}`;
}

export function fmtPercent(value: number | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return '0.00%';
  const formatted = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return n > 0 ? `+${formatted}%` : `${formatted}%`;
}

export function fmtDateTime(
  value: Date | string | null | undefined,
  includeSeconds = false,
  timeZone?: string,
  locale?: string,
): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
    hour12: false,
    ...(timeZone && { timeZone }),
  };

  return date.toLocaleString(locale || undefined, options);
}

/** Short timezone label, e.g. CST, GMT+8, or Asia/Shanghai fallback */
export function fmtTimezoneLabel(
  timeZone: string,
  reference: Date = new Date(),
  locale?: string,
): string {
  try {
    const parts = new Intl.DateTimeFormat(locale || undefined, {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(reference);
    return parts.find((p) => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone;
  }
}

/** Date + time in user timezone with short timezone suffix */
export function fmtDateTimeWithTimezone(
  value: Date | string | null | undefined,
  timeZone: string,
  locale?: string,
  includeSeconds = false,
): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '-';
  const dt = fmtDateTime(value, includeSeconds, timeZone, locale);
  const tz = fmtTimezoneLabel(timeZone, date, locale);
  return `${dt} (${tz})`;
}

export function fmtDuration(
  entryTime: Date | string | null | undefined,
  exitTime: Date | string | null | undefined,
  locale: 'zh' | 'en' = 'zh',
): string {
  if (!entryTime) return '-';

  const entry = typeof entryTime === 'string' ? new Date(entryTime) : entryTime;
  const exit = exitTime ? (typeof exitTime === 'string' ? new Date(exitTime) : exitTime) : null;

  if (isNaN(entry.getTime())) return '-';
  if (!exit) return locale === 'zh' ? '持仓中' : 'Open';
  if (isNaN(exit.getTime())) return '-';

  const diffMs = exit.getTime() - entry.getTime();
  if (diffMs <= 0) return '-';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (locale === 'zh') {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}时`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}分`);
    return parts.join('');
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join('');
}

export { COMMON_TIMEZONES, SUPPORTED_CURRENCIES } from './localeConstants';
