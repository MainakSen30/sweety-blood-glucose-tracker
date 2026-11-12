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

const DMY_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

/**
 * Parses a DD-MM-YYYY string and returns the equivalent YYYY-MM-DD string, or
 * null when the shape is wrong or the date does not exist on the calendar.
 * Pure string arithmetic — no Date parsing of the input.
 */
export function parseDDMMYYYY(value: string): string | null {
  const match = DMY_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const isoDate = date.toISOString().slice(0, 10);
  return isValidCalendarDate(isoDate) ? isoDate : null;
}

/** Formats a YYYY-MM-DD string as DD-MM-YYYY. */
export function toDDMMYYYY(value: string): string {
  const [year, month, day] = value.split('-');

  return `${day}-${month}-${year}`;
}
