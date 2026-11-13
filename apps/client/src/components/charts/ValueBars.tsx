/**
 * Simple value bars for report periods. Only days (or slots) with actual
 * readings are drawn — no interpolation, no fabricated data. Height is
 * relative to the largest recorded value; the dashed line marks the average.
 */
export interface ChartPoint {
  label: string;
  value: number;
}

export function ValueBars({
  points,
  average,
  title,
}: {
  points: ChartPoint[];
  average?: number | null;
  title: string;
}) {
  const maxValue = Math.max(...points.map((point) => point.value));

  return (
    <div role="img" aria-label={title} className="overflow-x-auto pb-1">
      <div className="relative min-w-[280px] pt-5">
        {average !== null && average !== undefined ? (
          <div
            className="pointer-events-none absolute inset-x-0 flex items-center"
            style={{ top: `${5 + (1 - average / maxValue) * 70}%` }}
          >
            <span className="text-[10px] font-medium tabular-nums text-ink-soft">
              avg {average.toFixed(1)}
            </span>
            <span className="ml-1 h-px flex-1 border-t border-dashed border-olive/50" />
          </div>
        ) : null}

        <div className="flex h-32 items-end gap-1 sm:h-40">
          {points.map((point) => (
            <div
              key={point.label}
              title={`${point.label}: ${point.value} mg/dL`}
              className="group flex min-w-[10px] flex-1 cursor-default flex-col items-center"
            >
              <span className="mb-1 hidden text-[10px] font-medium tabular-nums text-ink sm:group-hover:block">
                {point.value}
              </span>
              <div
                className="w-full rounded-t-md bg-olive transition-colors duration-150 group-hover:bg-olive-dark"
                style={{ height: `${Math.max((point.value / maxValue) * 100, 6)}%` }}
              />
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex gap-1">
          {points.map((point) => (
            <span
              key={point.label}
              className="min-w-[10px] flex-1 truncate text-center text-[9px] text-ink-soft"
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
