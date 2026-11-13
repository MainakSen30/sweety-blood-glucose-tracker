import { SLOT_ORDER } from '../../lib/slots.js';
import type { ReadingSlot } from '../../types/reading.js';

const SLOT_COLORS: Record<ReadingSlot, string> = {
  morning: '#596747',
  after_breakfast: '#8a9b78',
  after_lunch: '#c5cbb8',
  after_dinner: '#d4a97a',
};

const SLOT_DISPLAY_LABELS: Record<ReadingSlot, string> = {
  morning: 'Morning',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

export interface SlotDonutChartProps {
  counts: Record<ReadingSlot, number>;
  className?: string;
}

/**
 * SVG donut chart showing the distribution of readings across the four daily
 * time slots. Uses the stroke-dasharray technique on a circle with r=15.9155
 * (circumference ≈ 100) so percentages map directly to dash lengths.
 */
export function SlotDonutChart({ counts, className = '' }: SlotDonutChartProps) {
  const total = SLOT_ORDER.reduce((sum, slot) => sum + (counts[slot] ?? 0), 0);

  if (total === 0) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <p className="text-sm text-ink-soft">No readings for this period</p>
      </div>
    );
  }

  // r = 15.9155 → circumference ≈ 100, so pct values map 1:1 to dash lengths.
  // dashoffset: 25 shifts the starting point from 3 o'clock to 12 o'clock
  // (combined with the -rotate-90 on the SVG element).
  const segments = SLOT_ORDER.reduce<
    Array<{ slot: ReadingSlot; count: number; pct: number; dashoffset: number }>
  >((acc, slot) => {
    const count = counts[slot] ?? 0;
    const pct = (count / total) * 100;
    const cumulativePct = acc.reduce((sum, s) => sum + s.pct, 0);
    const dashoffset = 25 - cumulativePct;
    return [...acc, { slot, count, pct, dashoffset }];
  }, []);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative">
        <svg
          viewBox="0 0 42 42"
          role="img"
          aria-label="Readings by time slot donut chart"
          className="w-36 h-36 sm:w-40 sm:h-40 -rotate-90"
        >
          <title>Readings by time slot</title>
          {/* Background track */}
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e4e0d3" strokeWidth="4" />
          {segments.map(({ slot, count, pct, dashoffset }) => (
            <circle
              key={slot}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={SLOT_COLORS[slot]}
              strokeWidth="4"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
            >
              <title>{`${SLOT_DISPLAY_LABELS[slot]}: ${count} reading${count !== 1 ? 's' : ''} (${pct.toFixed(1)}%)`}</title>
            </circle>
          ))}
        </svg>
        {/* Center label — un-rotated by -rotate-90's inverse */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {total}
          </span>
          <span className="text-[10px] font-medium text-ink-soft">Total readings</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="w-full space-y-1.5" aria-label="Reading slot breakdown">
        {segments.map(({ slot, count, pct }) => (
          <li key={slot} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: SLOT_COLORS[slot] }}
              aria-hidden="true"
            />
            <span className="flex-1 text-xs text-ink">{SLOT_DISPLAY_LABELS[slot]}</span>
            <span className="tabular-nums text-xs text-ink-soft">{count}</span>
            <span className="w-10 text-right tabular-nums text-xs text-ink-soft">
              {pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
