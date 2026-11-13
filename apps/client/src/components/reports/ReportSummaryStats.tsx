import type { ReportSummary } from '../../types/report.js';

/**
 * The four report statistics in one scannable row. Values use tabular
 * numerals so columns align across report states.
 */
export function ReportSummaryStats({ summary }: { summary: ReportSummary }) {
  const items = [
    { label: 'Readings', value: String(summary.totalReadings) },
    { label: 'Average', value: summary.average === null ? '—' : summary.average.toFixed(1) },
    { label: 'Lowest', value: summary.lowest === null ? '—' : String(summary.lowest) },
    { label: 'Highest', value: summary.highest === null ? '—' : String(summary.highest) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dd className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {item.value}
            {item.label !== 'Readings' && item.value !== '—' ? (
              <span className="ml-1 text-sm font-normal text-ink-soft">mg/dL</span>
            ) : null}
          </dd>
          <dt className="mt-0.5 text-xs font-medium text-ink-soft">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}
