/**
 * Date helpers for the client.
 *
 * The API speaks DD-MM-YYYY (see the server's date utilities); HTML date
 * inputs speak YYYY-MM-DD. "Today" is resolved in Asia/Kolkata to match the
 * backend's future-date rule exactly — a client in a timezone ahead of
 * Kolkata must not offer a day the server will reject.
 */
const APP_TIMEZONE = 'Asia/Kolkata';

const DMY_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

/** Today's date as DD-MM-YYYY, in the application timezone. */
export function todayApiDate(): string {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-');

  return `${day}-${month}-${year}`;
}

/** Current hour (0–23) in the application timezone, for greetings. */
export function currentHourInAppTimezone(): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());

  return Number(hour);
}

/** Converts an API date (DD-MM-YYYY) to an HTML date-input value (YYYY-MM-DD). */
export function apiDateToInputValue(apiDate: string): string {
  const match = DMY_PATTERN.exec(apiDate);

  if (!match) {
    return '';
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Converts an HTML date-input value (YYYY-MM-DD) to the API form (DD-MM-YYYY). */
export function inputValueToApiDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return '';
  }

  return `${day}-${month}-${year}`;
}

/** Long human form for headings and group labels: "15 January 2026". */
export function formatLongDate(apiDate: string): string {
  const match = DMY_PATTERN.exec(apiDate);

  if (!match) {
    return apiDate;
  }

  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Compact human form for a report period: "1–13 November 2026" within one
 * month, "28 October – 3 November 2026" across months.
 */
export function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = DMY_PATTERN.exec(startDate);
  const end = DMY_PATTERN.exec(endDate);

  if (!start || !end) {
    return `${startDate} – ${endDate}`;
  }

  const [, startDay = '', startMonth = '', startYear = ''] = start;
  const [, endDay = '', endMonth = '', endYear = ''] = end;
  const monthName = (month: string) => MONTH_NAMES[Number(month) - 1] ?? month;

  if (startMonth === endMonth && startYear === endYear) {
    return `${Number(startDay)}–${Number(endDay)} ${monthName(startMonth)} ${startYear}`;
  }

  return `${Number(startDay)} ${monthName(startMonth)} – ${Number(endDay)} ${monthName(endMonth)} ${endYear}`;
}
