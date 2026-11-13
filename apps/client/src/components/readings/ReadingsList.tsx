import type { Reading } from '../../types/reading.js';
import { slotLabel } from '../../lib/slots.js';
import { formatLongDate } from '../../lib/date.js';
import { PencilIcon, TrashIcon } from '../ui/icons.js';

interface ReadingsListProps {
  readings: Reading[];
  onEdit?: (reading: Reading) => void;
  onDelete?: (reading: Reading) => void;
}

interface RowProps {
  reading: Reading;
  onEdit?: (reading: Reading) => void;
  onDelete?: (reading: Reading) => void;
}

function ReadingRow({ reading, onEdit, onDelete }: RowProps) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{slotLabel(reading.slot)}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums text-ink">
        {reading.value}
        <span className="ml-1 text-xs font-normal text-ink-soft">mg/dL</span>
      </p>
      {onEdit && onDelete ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(reading)}
            aria-label={`Edit ${slotLabel(reading.slot).toLowerCase()} reading on ${reading.readingDate}`}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-sage/50 hover:text-ink"
          >
            <PencilIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(reading)}
            aria-label={`Delete ${slotLabel(reading.slot).toLowerCase()} reading on ${reading.readingDate}`}
            className="rounded-lg p-2 text-ink-soft transition-colors duration-150 hover:bg-terracotta/15 hover:text-terracotta-ink"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Readings grouped by date (newest first — the API already sorts this way),
 * with optional edit/delete actions.
 */
export function ReadingsList({ readings, onEdit, onDelete }: ReadingsListProps) {
  const groups = new Map<string, Reading[]>();

  for (const reading of readings) {
    const group = groups.get(reading.readingDate);

    if (group) {
      group.push(reading);
    } else {
      groups.set(reading.readingDate, [reading]);
    }
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([date, dayReadings]) => (
        <div key={date}>
          <h3 className="mb-1 text-sm font-semibold text-olive-dark">{formatLongDate(date)}</h3>
          <ul>
            {dayReadings.map((reading) => (
              <ReadingRow key={reading.id} reading={reading} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
