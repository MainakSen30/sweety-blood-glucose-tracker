import { describe, it, expect } from 'vitest';
import { slotCounts } from './chart.js';
import type { ReadingSlot } from '../types/reading.js';

describe('slotCounts', () => {
  it('counts each slot correctly', () => {
    const readings = [
      { slot: 'morning' as ReadingSlot },
      { slot: 'morning' as ReadingSlot },
      { slot: 'after_breakfast' as ReadingSlot },
      { slot: 'after_lunch' as ReadingSlot },
      { slot: 'after_dinner' as ReadingSlot },
      { slot: 'after_dinner' as ReadingSlot },
    ];
    const result = slotCounts(readings);
    expect(result.morning).toBe(2);
    expect(result.after_breakfast).toBe(1);
    expect(result.after_lunch).toBe(1);
    expect(result.after_dinner).toBe(2);
  });

  it('returns zeros for all slots when given empty array', () => {
    const result = slotCounts([]);
    expect(result.morning).toBe(0);
    expect(result.after_breakfast).toBe(0);
    expect(result.after_lunch).toBe(0);
    expect(result.after_dinner).toBe(0);
  });

  it('does not double-count readings', () => {
    const readings = Array.from({ length: 10 }, () => ({ slot: 'morning' as ReadingSlot }));
    const result = slotCounts(readings);
    expect(result.morning).toBe(10);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(10);
  });

  it('handles readings with only some slots present', () => {
    const readings = [{ slot: 'morning' as ReadingSlot }, { slot: 'after_lunch' as ReadingSlot }];
    const result = slotCounts(readings);
    expect(result.morning).toBe(1);
    expect(result.after_breakfast).toBe(0);
    expect(result.after_lunch).toBe(1);
    expect(result.after_dinner).toBe(0);
  });
});
