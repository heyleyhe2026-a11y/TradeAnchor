/**
 * Timezone conversion utilities
 */

/**
 * Convert UTC timestamp to user's local timezone
 * @param utcTimestamp - UTC timestamp string or Date object
 * @param timezone - Target timezone (optional, defaults to user's browser timezone)
 * @returns Formatted date string in local timezone
 */
export const convertToLocalTime = (
  utcTimestamp: string | Date,
  timezone?: string
): string => {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  
  if (timezone) {
    return date.toLocaleString('en-US', { timeZone: timezone });
  }
  
  return date.toLocaleString();
};

/**
 * Convert local time to UTC
 * @param localTime - Local time string or Date object
 * @returns UTC Date object
 */
export const convertToUTC = (localTime: string | Date): Date => {
  const date = typeof localTime === 'string' ? new Date(localTime) : localTime;
  return new Date(date.toUTCString());
};

/**
 * Format date with timezone
 * @param date - Date to format
 * @param format - Format options
 * @param timezone - Target timezone
 * @returns Formatted date string
 */
export const formatDateWithTimezone = (
  date: Date | string,
  format: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  },
  timezone?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    ...format,
    ...(timezone && { timeZone: timezone }),
  };
  
  return dateObj.toLocaleString(undefined, options);
};

/**
 * Get user's browser timezone
 * @returns Timezone string (e.g., 'America/New_York')
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get timezone offset in hours
 * @param timezone - Timezone string
 * @returns Offset in hours
 */
export const getTimezoneOffset = (timezone?: string): number => {
  const date = new Date();
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(
    date.toLocaleString('en-US', { timeZone: timezone || getUserTimezone() })
  );
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
};

/**
 * List of common timezones
 */
export const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'UTC', label: 'UTC' },
];
