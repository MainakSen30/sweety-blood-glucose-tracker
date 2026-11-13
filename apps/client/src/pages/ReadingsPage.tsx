import { useCallback, useEffect, useState } from 'react';
import { listReadings } from '../services/readingsApi.js';
import type { PaginatedReadings } from '../types/reading.js';
import { apiDateToInputValue, inputValueToApiDate, todayApiDate } from '../lib/date.js';
import { Button, Spinner } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { StatusNote } from '../components/ui/StatusNote.js';
import { useStatusNote } from '../lib/useStatusNote.js';
import { PlusIcon } from '../components/ui/icons.js';
import { ReadingsList } from '../components/readings/ReadingsList.js';
import { ReadingsPagination } from '../components/readings/ReadingsPagination.js';
import { useReadingDialogs } from '../components/readings/useReadingDialogs.js';

const DEFAULT_PAGE_SIZE = 20;

export default function ReadingsPage() {
  const [result, setResult] = useState<PaginatedReadings | null>(null);
  const [error, setError] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [statusMessage, showMessage, clearMessage] = useStatusNote();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await listReadings({
          page,
          limit: pageSize,
          ...(dateFilter ? { date: inputValueToApiDate(dateFilter) } : {}),
        });

        if (cancelled) return;

        // Deleting the last reading on a page can leave it past the end.
        // Move to the last page that still has records.
        if (next.pagination.totalPages > 0 && page > next.pagination.totalPages) {
          setResult(null);
          setPage(next.pagination.totalPages);
          return;
        }

        setResult(next);
        setError(false);
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateFilter, page, pageSize, reloadNonce]);

  const refresh = useCallback(() => setReloadNonce((nonce) => nonce + 1), []);
  // Full reload (spinner) for retries; in-place update after mutations.
  const refetch = useCallback(() => {
    setResult(null);
    setError(false);
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  const goToPage = useCallback((nextPage: number) => {
    setResult(null);
    setError(false);
    setPage(nextPage);
  }, []);

  const changePageSize = useCallback((nextPageSize: number) => {
    setResult(null);
    setError(false);
    setPage(1);
    setPageSize(nextPageSize);
  }, []);

  const { openAdd, openEdit, openDelete, dialogs } = useReadingDialogs(() => {
    refresh();
    showMessage('Readings updated.');
  });

  const readings = result?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Readings</h1>
          <p className="mt-1 text-sm text-ink-soft">Your complete glucose history.</p>
        </div>
        <Button onClick={() => openAdd()}>
          <PlusIcon className="size-4" />
          Add reading
        </Button>
      </div>

      <StatusNote message={statusMessage} onDone={clearMessage} />

      <Card>
        <Field label="Filter by date" hint="Leave empty to see your full history.">
          {(fieldProps) => (
            <Input
              fieldProps={fieldProps}
              type="date"
              value={dateFilter}
              max={apiDateToInputValue(todayApiDate())}
              onChange={(event) => {
                setResult(null);
                setError(false);
                setPage(1);
                setDateFilter(event.target.value);
              }}
              className="max-w-56"
            />
          )}
        </Field>

        <div className="mt-5">
          {error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-soft">We couldn't load your readings.</p>
              <Button variant="secondary" className="mt-3" onClick={refetch}>
                Try again
              </Button>
            </div>
          ) : result === null ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6 text-olive" />
            </div>
          ) : (
            <>
              {readings.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-ink-soft">
                    {dateFilter
                      ? 'No readings on this date. Clear the filter to see your full history.'
                      : 'No readings yet. Add your first reading to start building your history.'}
                  </p>
                  {!dateFilter ? (
                    <Button className="mt-3" onClick={() => openAdd()}>
                      <PlusIcon className="size-4" />
                      Add first reading
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="mt-3"
                      onClick={() => {
                        setResult(null);
                        setError(false);
                        setPage(1);
                        setDateFilter('');
                      }}
                    >
                      Clear filter
                    </Button>
                  )}
                </div>
              ) : (
                <ReadingsList readings={readings} onEdit={openEdit} onDelete={openDelete} />
              )}

              <ReadingsPagination
                pagination={result.pagination}
                pageSize={pageSize}
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />
            </>
          )}
        </div>
      </Card>

      {dialogs}
    </div>
  );
}
