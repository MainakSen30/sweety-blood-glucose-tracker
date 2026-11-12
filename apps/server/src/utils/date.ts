/**
 * Date-only utilities.
 *
 * Glucose readings belong to a calendar day. Everything here works on
 * `YYYY-MM-DD` strings and never goes through JavaScript `Date` timestamps for
 * storage or comparison, so timezone conversion cannot shift the day.
 *
 * "Today" is determined in the application timezone, Asia/Kolkata (documented
 * in the README as the assignment timezone convention).
 */
export const APP_TIMEZONE = 'Asia/Kolkata';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the string has the exact YYYY-MM-DD shape and represents a real
 * calendar date (for example 2026-02-30 is rejected).
 */
export function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Today's calendar date (YYYY-MM-DD) in the application timezone. */
export function todayInAppTimezone(): string {
  // en-CA formats as YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** True when the date is after today in the application timezone. */
export function isFutureDate(value: string): boolean {
  // ISO strings compare correctly lexicographically.
  return value > todayInAppTimezone();
}

/** Tomorrow's calendar date (YYYY-MM-DD) in the application timezone (test helper). */
export function tomorrowInAppTimezone(): string {
  const today = todayInAppTimezone();
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));

  return tomorrow.toISOString().slice(0, 10);
}
