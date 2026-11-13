import { chronologicalReadings } from '../../lib/chart.js';
import { formatLongDate, formatShortDate } from '../../lib/date.js';
import { SLOT_ORDER, SLOT_SHORT_LABELS, slotLabel } from '../../lib/slots.js';
import type { ReadingSlot } from '../../types/reading.js';

export interface TrendReading {
  id: string;
  readingDate: string;
  slot: ReadingSlot;
  value: number;
}

interface PlottedPoint extends TrendReading {
  /** Horizontal position in the 0–1 plot area. */
  x: number;
  /** Vertical position in the 0–1 plot area (1 = top). */
  y: number;
}

interface AxisLabel {
  label: string;
  x: number;
}

/**
 * Individual glucose readings over the report period.
 *
 * Plain SVG rather than a charting dependency, matching the existing
 * ValueBars/donut charts. Only recorded readings become points; a single
 * reading draws no line, and missing days produce no point.
 */
export function GlucoseTrendChart({
  readings,
  className = '',
}: {
  readings: TrendReading[];
  className?: string;
}) {
  const sorted = chronologicalReadings(readings);
  const dates = [...new Set(sorted.map((reading) => reading.readingDate))];
  const singleDay = dates.length === 1;
  const axis = buildAxis(sorted, dates, singleDay);

  return (
    <div role="group" aria-label="Glucose trends chart" className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h3 className="text-sm font-semibold text-ink">Glucose trends</h3>
          <p className="mt-0.5 text-xs text-ink-soft">Your recorded glucose readings over time</p>
        </div>
        <span className="text-[11px] text-ink-soft">mg/dL</span>
      </div>

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">No readings for this period</p>
      ) : (
        <>
          <p className="sr-only">
            {summaryText(sorted, dates, singleDay)}
            {axis.points.map(
              (point) =>
                ` ${formatLongDate(point.readingDate)}, ${slotLabel(point.slot)}, ${point.value} mg/dL.`,
            )}
          </p>

          <div className="mt-5 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
            {/* Y-axis labels share the plot's height so ticks line up. */}
            <div className="relative h-48 sm:h-56" aria-hidden="true">
              {axis.ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-ink-soft"
                  style={{ top: `${(1 - (tick - axis.min) / (axis.max - axis.min)) * 100}%` }}
                >
                  {tick}
                </span>
              ))}
            </div>

            <div className="relative h-48 overflow-visible sm:h-56">
              {axis.ticks.map((tick) => (
                <div
                  key={tick}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-line/80"
                  style={{ top: `${(1 - (tick - axis.min) / (axis.max - axis.min)) * 100}%` }}
                />
              ))}

              <svg
                aria-hidden="true"
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {axis.points.length > 1 ? (
                  <polyline
                    points={axis.points
                      .map((point) => `${point.x * 100},${(1 - point.y) * 100}`)
                      .join(' ')}
                    fill="none"
                    stroke="var(--color-olive)"
                    strokeOpacity="0.45"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>

              {axis.points.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  aria-label={`${formatLongDate(point.readingDate)}, ${slotLabel(point.slot)}, ${point.value} mg/dL`}
                  className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 focus-visible:z-20"
                  style={{ left: `${point.x * 100}%`, top: `${(1 - point.y) * 100}%` }}
                >
                  <span
                    aria-hidden="true"
                    className="block size-2.5 rounded-full border border-surface bg-olive ring-1 ring-olive/25 transition-colors duration-150 group-hover:bg-olive-dark group-focus:bg-olive-dark"
                  />
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute z-20 hidden w-44 max-w-[min(11rem,calc(100vw-4rem))] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-[11px] leading-snug shadow-sm group-hover:block group-focus:block ${
                      point.y > 0.7 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                    } ${tooltipAlignment(point.x)}`}
                  >
                    <span className="block text-ink">{formatLongDate(point.readingDate)}</span>
                    <span className="block text-ink-soft">{slotLabel(point.slot)}</span>
                    <span className="block font-medium tabular-nums text-ink">
                      {point.value} mg/dL
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div aria-hidden="true" />

            <div className="relative mt-2 h-4">
              {axis.labels.map((label) => (
                <span
                  key={`${label.label}-${label.x}`}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-ink-soft"
                  style={{ left: `${label.x * 100}%` }}
                >
                  {label.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function tooltipAlignment(x: number): string {
  if (x < 0.18) return 'left-0';
  if (x > 0.82) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

/** Short, readable y-axis scale that always contains every recorded value. */
function buildAxis(readings: TrendReading[], dates: string[], singleDay: boolean) {
  const values = readings.map((reading) => reading.value);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const span = Math.max(highest - lowest, 20);
  const step = niceStep(span / 3);
  const min = Math.max(0, Math.floor((lowest - span * 0.1) / step) * step);
  const max = Math.ceil((highest + span * 0.1) / step) * step;
  const ticks: number[] = [];

  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  const perDate = new Map<string, TrendReading[]>();

  for (const reading of readings) {
    perDate.set(reading.readingDate, [...(perDate.get(reading.readingDate) ?? []), reading]);
  }

  // A single day has no date trend, so the x-axis becomes the four slots.
  // Periods spread each day's readings over a narrow band, preserving every
  // observation while keeping the day labels meaningful.
  const domainMin = singleDay ? -0.35 : -0.45;
  const domainMax = singleDay ? 3.35 : dates.length - 1 + 0.45;
  const toPlotX = (position: number) => (position - domainMin) / (domainMax - domainMin);

  const points: PlottedPoint[] = readings.map((reading) => {
    let position: number;

    if (singleDay) {
      position = SLOT_ORDER.indexOf(reading.slot);
    } else {
      const dayReadings = perDate.get(reading.readingDate) ?? [];
      const index = dayReadings.findIndex((candidate) => candidate.id === reading.id);
      const offset =
        dayReadings.length === 1
          ? 0
          : (index - (dayReadings.length - 1) / 2) * (0.6 / (dayReadings.length - 1));
      position = dates.indexOf(reading.readingDate) + offset;
    }

    return {
      ...reading,
      x: toPlotX(position),
      y: (reading.value - min) / (max - min),
    };
  });

  const labels: AxisLabel[] = singleDay
    ? SLOT_ORDER.map((slot) => ({
        label: SLOT_SHORT_LABELS[slot],
        x: toPlotX(SLOT_ORDER.indexOf(slot)),
      }))
    : pickDateLabels(dates).map((date) => ({
        label: formatShortDate(date),
        x: toPlotX(dates.indexOf(date)),
      }));

  return { points, ticks, min, max, labels };
}

/** At most six date labels keep the axis readable on narrow screens. */
function pickDateLabels(dates: string[]): string[] {
  if (dates.length <= 6) return dates;

  return Array.from(
    { length: 6 },
    (_, index) => dates[Math.round((index * (dates.length - 1)) / 5)] as string,
  );
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

function summaryText(readings: TrendReading[], dates: string[], singleDay: boolean): string {
  const values = readings.map((reading) => reading.value);
  const range = singleDay
    ? formatLongDate(dates[0] ?? '')
    : `${formatLongDate(dates[0] ?? '')} to ${formatLongDate(dates[dates.length - 1] ?? '')}`;

  return `${readings.length} reading${readings.length === 1 ? '' : 's'} on ${range}. Lowest ${Math.min(...values)} mg/dL, highest ${Math.max(...values)} mg/dL.`;
}
