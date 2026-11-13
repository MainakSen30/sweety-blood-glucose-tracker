import type { Reading, ReadingSlot } from '../types/reading.js';
import type { ChartPoint } from '../components/charts/ValueBars.js';
import { SLOT_ORDER } from './slots.js';

/**
 * Reading order for the trend chart: chronological by date, then by the
 * application's slot order. The list endpoint returns newest-first, so the
 * chart cannot rely on its ordering. DD-MM-YYYY does not sort
 * lexicographically, hence the explicit YYYY-MM-DD key.
 */
export function chronologicalReadings<
  T extends { readingDate: string; slot: ReadingSlot; id?: string },
>(readings: readonly T[]): T[] {
  return [...readings].sort((a, b) => {
    const dateOrder = sortKey(a.readingDate).localeCompare(sortKey(b.readingDate));

    if (dateOrder !== 0) return dateOrder;

    const slotOrder = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);

    if (slotOrder !== 0) return slotOrder;

    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

function sortKey(apiDate: string): string {
  const [day = '', month = '', year = ''] = apiDate.split('-');
  return `${year}-${month}-${day}`;
}

/** Counts of readings per slot from any array of objects with a .slot field. */
export function slotCounts(
  readings: ReadonlyArray<{ slot: ReadingSlot }>,
): Record<ReadingSlot, number> {
  const counts: Record<ReadingSlot, number> = {
    morning: 0,
    after_breakfast: 0,
    after_lunch: 0,
    after_dinner: 0,
  };
  for (const r of readings) {
    counts[r.slot] = (counts[r.slot] ?? 0) + 1;
  }
  return counts;
}

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
