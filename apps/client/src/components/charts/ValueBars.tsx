import { motion, useReducedMotion } from 'motion/react';

/**
 * Simple value bars for report periods. Only days (or slots) with actual
 * readings are drawn — no interpolation, no fabricated data. Bar height is
 * relative to the largest recorded value; the dashed line marks the average
 * and lives inside the bars' coordinate space (bottom-anchored) so it lines
 * up with the bars exactly.
 *
 * Bars grow from the baseline when `animate` is set (report views, where the
 * data arrives after a load). The landing page's demo chart passes nothing
 * and stays static.
 */
export interface ChartPoint {
  label: string;
  value: number;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function ValueBars({
  points,
  average,
  title,
  animate = false,
}: {
  points: ChartPoint[];
  average?: number | null;
  title: string;
  animate?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const grow = animate && !reduceMotion;
  const maxValue = Math.max(...points.map((point) => point.value));

  return (
    <div role="img" aria-label={title} className="overflow-x-auto pb-1">
      {/* pt-6 gives the avg label headroom when the average equals the max */}
      <div className="relative min-w-[280px] pt-6">
        <div className="relative flex h-32 items-end gap-1 sm:h-40">
          {points.map((point, index) => (
            <div
              key={point.label}
              title={`${point.label}: ${point.value} mg/dL`}
              className="flex h-full min-w-[10px] max-w-10 flex-1 cursor-default flex-col items-center justify-end"
            >
              <motion.div
                initial={grow ? { scaleY: 0 } : false}
                animate={grow ? { scaleY: 1 } : undefined}
                transition={{ duration: 0.25, ease: EASE, delay: Math.min(index * 0.03, 0.3) }}
                style={{ height: `${(point.value / maxValue) * 100}%`, transformOrigin: 'bottom' }}
                className="w-full rounded-t-md bg-olive transition-colors duration-150 hover:bg-olive-dark"
              />
            </div>
          ))}

          {average !== null && average !== undefined ? (
            <motion.div
              initial={grow ? { opacity: 0 } : false}
              animate={grow ? { opacity: 1 } : undefined}
              transition={{ duration: 0.25, ease: EASE }}
              className="pointer-events-none absolute inset-x-0"
              style={{ bottom: `${(average / maxValue) * 100}%` }}
            >
              <div className="relative h-0 border-t border-dashed border-olive/50">
                <span className="absolute -top-5 left-0 text-[10px] font-medium tabular-nums text-ink-soft">
                  avg {average.toFixed(1)}
                </span>
              </div>
            </motion.div>
          ) : null}
        </div>

        <div className="mt-1.5 flex gap-1">
          {points.map((point) => (
            <span
              key={point.label}
              className="min-w-[10px] max-w-10 flex-1 truncate text-center text-[10px] text-ink-soft"
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
