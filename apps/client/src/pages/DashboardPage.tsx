import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { getDailyReport, getMonthToDateReport, getMonthlyReport } from '../services/reportsApi.js';
import { listReadings } from '../services/readingsApi.js';
import type { DailyReport, PeriodReport } from '../types/report.js';
import type { Reading } from '../types/reading.js';
import type { SafeUser } from '../types/user.js';
import {
  formatLongDate,
  formatPeriodLabel,
  todayApiDate,
  currentHourInAppTimezone,
} from '../lib/date.js';
import { SLOT_ORDER, slotLabel, slotShortLabel } from '../lib/slots.js';
import { useAuth } from '../context/auth.js';
import { Card } from '../components/ui/Card.js';
import { Button, Spinner } from '../components/ui/Button.js';
import { StatusNote } from '../components/ui/StatusNote.js';
import { useStatusNote } from '../lib/useStatusNote.js';
import { ArrowRightIcon, PlusIcon } from '../components/ui/icons.js';
import { ReadingsList } from '../components/readings/ReadingsList.js';
import { useReadingDialogs } from '../components/readings/useReadingDialogs.js';

interface DashboardData {
  daily: DailyReport;
  monthToDate: PeriodReport;
  monthly: PeriodReport;
  recent: Reading[];
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [statusMessage, showMessage, clearMessage] = useStatusNote();
  const today = todayApiDate();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [daily, monthToDate, monthly, recentPage] = await Promise.all([
          getDailyReport(today),
          getMonthToDateReport(today),
          getMonthlyReport(),
          listReadings({ limit: 6 }),
        ]);

        if (cancelled) return;

        setData({ daily, monthToDate, monthly, recent: recentPage.data });
        setError(false);
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [today, reloadNonce]);

  const refresh = useCallback(() => setReloadNonce((nonce) => nonce + 1), []);

  const retry = () => {
    setLoading(true);
    refresh();
  };

  const { openAdd, openEdit, openDelete, dialogs } = useReadingDialogs(() => {
    refresh();
    showMessage('Readings updated.');
  });

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-6 text-olive" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-ink-soft">We couldn't load your dashboard.</p>
        <Button variant="secondary" className="mt-3" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const readingsBySlot = new Map(data.daily.readings.map((reading) => [reading.slot, reading]));
  const summary = data.daily.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {greeting(currentHourInAppTimezone())}
            {user ? `, ${firstName(user)}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{formatLongDate(today)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {error && data ? (
            <p className="text-xs text-terracotta-ink">Latest refresh failed.</p>
          ) : null}
          <StatusNote message={statusMessage} onDone={clearMessage} />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}
      >
        <Card>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Today's readings</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {SLOT_ORDER.map((slot) => {
              const reading = readingsBySlot.get(slot);

              return reading ? (
                <button
                  key={slot}
                  type="button"
                  onClick={() => openEdit(asReading(reading))}
                  className="rounded-xl bg-sage/40 p-3 text-left transition-colors duration-150 hover:bg-sage/70"
                >
                  <span className="block text-xs font-medium text-ink-soft">
                    {slotShortLabel(slot)}
                  </span>
                  <span className="mt-1 block text-xl font-semibold tabular-nums text-ink">
                    {reading.value}
                    <span className="ml-1 text-xs font-normal text-ink-soft">mg/dL</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-soft">{slotLabel(slot)}</span>
                </button>
              ) : (
                <button
                  key={slot}
                  type="button"
                  onClick={() => openAdd(today, slot)}
                  className="rounded-xl border border-dashed border-line bg-cream/60 p-3 text-left transition-colors duration-150 hover:border-olive/50 hover:bg-sage/25"
                >
                  <span className="block text-xs font-medium text-ink-soft">
                    {slotShortLabel(slot)}
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-sm font-medium text-olive">
                    <PlusIcon className="size-3.5" />
                    Add
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-line pt-4">
            {summary.totalReadings > 0 ? (
              <p className="text-sm text-ink-soft">
                <span className="whitespace-nowrap">
                  Today's average{' '}
                  <strong className="font-semibold tabular-nums text-ink">
                    {summary.average?.toFixed(1)} mg/dL
                  </strong>
                </span>{' '}
                <span className="whitespace-nowrap">
                  · lowest{' '}
                  <strong className="font-semibold tabular-nums text-ink">{summary.lowest}</strong>
                </span>{' '}
                <span className="whitespace-nowrap">
                  · highest{' '}
                  <strong className="font-semibold tabular-nums text-ink">{summary.highest}</strong>
                </span>
              </p>
            ) : (
              <p className="text-sm text-ink-soft">
                No readings yet today. Recorded slots fill in as you add them.
              </p>
            )}
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Month by month</h2>
          <dl className="mt-4 space-y-4">
            <MonthStat
              label="Month to date"
              summary={data.monthToDate.summary}
              period={data.monthToDate.period}
            />
            <MonthStat
              label="Previous month"
              summary={data.monthly.summary}
              period={data.monthly.period}
            />
          </dl>
          <Link
            to="/reports"
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-olive underline-offset-2 hover:text-olive-dark hover:underline"
          >
            View full reports
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Recent readings</h2>
            <Link
              to="/readings"
              className="inline-flex min-h-11 items-center text-sm font-medium text-olive underline-offset-2 hover:text-olive-dark hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-3">
            {data.recent.length > 0 ? (
              <ReadingsList readings={data.recent} onEdit={openEdit} onDelete={openDelete} />
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-ink-soft">
                  No readings yet. Your history will build up here as you record them.
                </p>
                <Button className="mt-3" onClick={() => openAdd()}>
                  <PlusIcon className="size-4" />
                  Add first reading
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {dialogs}
    </div>
  );
}

function firstName(user: SafeUser): string {
  return user.name.split(' ')[0] ?? user.name;
}

/** Bridges the report reading shape onto the shared Reading type. */
function asReading(reportReading: DailyReport['readings'][number]): Reading {
  return {
    id: reportReading.id,
    userId: '',
    readingDate: reportReading.readingDate,
    slot: reportReading.slot,
    value: reportReading.value,
    createdAt: '',
    updatedAt: '',
  };
}

function MonthStat({
  label,
  summary,
  period,
}: {
  label: string;
  summary: PeriodReport['summary'];
  period: PeriodReport['period'];
}) {
  return (
    <div className="border-b border-line pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm font-medium text-ink">{label}</dt>
        <dd className="text-sm tabular-nums text-ink-soft">
          {formatPeriodLabel(period.startDate, period.endDate)}
        </dd>
      </div>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {summary.average === null ? '—' : summary.average.toFixed(1)}
        <span className="ml-1 text-sm font-normal text-ink-soft">mg/dL avg</span>
      </dd>
      <p className="mt-0.5 text-xs text-ink-soft">
        {summary.totalReadings} reading{summary.totalReadings === 1 ? '' : 's'} recorded
      </p>
    </div>
  );
}
