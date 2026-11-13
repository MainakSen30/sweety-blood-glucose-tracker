import { describe, expect, it } from 'vitest';
import {
  apiDateToInputValue,
  formatLongDate,
  formatPeriodLabel,
  formatShortDate,
  inputValueToApiDate,
  todayApiDate,
} from './date';

describe('todayApiDate', () => {
  it('returns today in the API form DD-MM-YYYY, zero-padded', () => {
    expect(todayApiDate()).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });
});

describe('API ↔ input date conversion', () => {
  it('converts DD-MM-YYYY to the HTML input value', () => {
    expect(apiDateToInputValue('15-01-2026')).toBe('2026-01-15');
  });

  it('converts the HTML input value back to DD-MM-YYYY', () => {
    expect(inputValueToApiDate('2026-01-15')).toBe('15-01-2026');
  });

  it('round-trips through both directions', () => {
    expect(apiDateToInputValue(inputValueToApiDate('2026-02-29'))).toBe('2026-02-29');
  });

  it('returns an empty string for malformed API dates', () => {
    expect(apiDateToInputValue('2026-01-15')).toBe('');
  });

  it('formats long dates for headings', () => {
    expect(formatLongDate('15-01-2026')).toBe('15 January 2026');
  });

  it('formats compact dates for chart axes', () => {
    expect(formatShortDate('01-11-2026')).toBe('01 Nov');
  });

  it('formats a single-month period compactly', () => {
    expect(formatPeriodLabel('01-11-2026', '13-11-2026')).toBe('1–13 November 2026');
  });

  it('formats a cross-month period with both months', () => {
    expect(formatPeriodLabel('28-10-2026', '03-11-2026')).toBe('28 October – 3 November 2026');
  });
});
