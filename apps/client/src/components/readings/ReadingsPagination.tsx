import type { PaginationMetadata } from '../../types/reading.js';
import { Button } from '../ui/Button.js';

interface ReadingsPaginationProps {
  pagination: PaginationMetadata;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (limit: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Compact range + previous/next controls below the readings list. */
export function ReadingsPagination({
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ReadingsPaginationProps) {
  const { page, limit, total, totalPages, hasNextPage, hasPreviousPage } = pagination;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);
  const rangeLabel =
    total === 0
      ? 'Showing 0 of 0 readings'
      : `Showing ${rangeStart}–${rangeEnd} of ${total} readings`;

  return (
    <nav
      aria-label="Readings pagination"
      className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-ink-soft">{rangeLabel}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 flex items-center gap-1.5 text-xs text-ink-soft">
          Per page
          <select
            aria-label="Readings per page"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink transition-colors duration-150 hover:border-olive/40 focus:border-olive focus:outline-none focus:ring-2 focus:ring-olive/25"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
        >
          Previous
        </Button>

        <span aria-live="polite" className="px-1 text-xs font-medium tabular-nums text-ink">
          Page {page} of {Math.max(totalPages, 1)}
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
