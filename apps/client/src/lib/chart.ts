import type { Reading } from '../types/reading.js';
import type { ChartPoint } from '../components/charts/ValueBars.js';

/**
 * One point per day that has readings: the day's mean, labeled by day of
 * month. Days without readings produce no point — nothing is interpolated.
 */
export function dailyAveragePoints(readings: Reading[]): ChartPoint[] {
  const totals = new Map<string, { sum: number; count: number }>();

  for (const reading of readings) {
    const day = totals.get(reading.readingDate) ?? { sum: 0, count: 0 };
    day.sum += reading.value;
    day.count += 1;
    totals.set(reading.readingDate, day);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      label: date.slice(0, 2), // day of month, DD-MM-YYYY
      value: Math.round((sum / count) * 10) / 10,
    }));
}
