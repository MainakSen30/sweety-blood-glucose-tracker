import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  getDailyReport,
  getMonthlyReport,
  getMonthToDateReport,
  getReportJobResult,
  getReportJobStatus,
  submitReportJob,
} from '../services/reportsApi.js';
import { listAllReadings } from '../services/readingsApi.js';
import type { DailyReport, PeriodReport, ReportJobStatus } from '../types/report.js';
import type { Reading } from '../types/reading.js';
import {
  apiDateToInputValue,
  formatLongDate,
  formatPeriodLabel,
  inputValueToApiDate,
  todayApiDate,
} from '../lib/date.js';
import { dailyAveragePoints, slotCounts } from '../lib/chart.js';
import { slotShortLabel } from '../lib/slots.js';
import { Button, LoadingState, Spinner } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { ReportSummaryStats } from '../components/reports/ReportSummaryStats.js';
import { ValueBars } from '../components/charts/ValueBars.js';
import { SlotDonutChart } from '../components/charts/SlotDonutChart.js';
import { GlucoseTrendChart } from '../components/charts/GlucoseTrendChart.js';
import { ReadingsList } from '../components/readings/ReadingsList.js';

type ReportTab = 'daily' | 'month-to-date' | 'monthly';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'month-to-date', label: 'Month to date' },
  { id: 'monthly', label: 'Previous month' },
];

interface ReportState {
  daily: DailyReport | null;
  period: PeriodReport | null;
  periodReadings: Reading[];
}

const EMPTY_STATE: ReportState = { daily: null, period: null, periodReadings: [] };

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('daily');
  const [dailyDate, setDailyDate] = useState(apiDateToInputValue(todayApiDate()));
  const [mtdDate, setMtdDate] = useState(apiDateToInputValue(todayApiDate()));
  const [state, setState] = useState<ReportState>(EMPTY_STATE);
  const [error, setError] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Asynchronous background report generation state.
  const [job, setJob] = useState<ReportJobStatus | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const requestKey = `${tab}|${dailyDate}|${mtdDate}|${reloadNonce}`;
  // Until the response for the current tab/date arrives, there is nothing valid to show.
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const key = `${tab}|${dailyDate}|${mtdDate}|${reloadNonce}`;

    void (async () => {
      try {
        let next: ReportState;

        if (tab === 'daily') {
          next = { ...EMPTY_STATE, daily: await getDailyReport(inputValueToApiDate(dailyDate)) };
        } else {
          const periodReport =
            tab === 'month-to-date'
              ? await getMonthToDateReport(inputValueToApiDate(mtdDate))
              : await getMonthlyReport();
          // The chart draws actual readings across the report's own period,
          // so the dates come from the API response — no range math here.
          const periodReadings = await listAllReadings({
            from: periodReport.period.startDate,
            to: periodReport.period.endDate,
          });
          next = { daily: null, period: periodReport, periodReadings };
        }

        if (!cancelled) {
          setState(next);
          setError(false);
          setLoadedKey(key);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoadedKey(key);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, dailyDate, mtdDate, reloadNonce]);

  // Polling loop for active background report jobs.
  useEffect(() => {
    if (!job) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    let cancelled = false;
    const pollIntervalMs = 1000;

    const intervalId = window.setInterval(async () => {
      try {
        const statusData = await getReportJobStatus(job.jobId);
        if (cancelled) return;

        setJob((prev) => (prev ? { ...prev, ...statusData } : null));

        if (statusData.status === 'completed') {
          window.clearInterval(intervalId);
          try {
            const result = await getReportJobResult(job.jobId);
            if (cancelled) return;
            if (result.reportType === 'daily') {
              setState({ ...EMPTY_STATE, daily: result as DailyReport });
            } else {
              const periodReport = result as PeriodReport;
              const periodReadings = await listAllReadings({
                from: periodReport.period.startDate,
                to: periodReport.period.endDate,
              });
              setState({ daily: null, period: periodReport, periodReadings });
            }
            setLoadedKey(requestKey);
            setError(false);
          } catch (fetchErr) {
            if (!cancelled) {
              setJobError(
                fetchErr instanceof Error ? fetchErr.message : 'Failed to retrieve report result.',
              );
            }
          }
        } else if (statusData.status === 'failed') {
          window.clearInterval(intervalId);
        }
      } catch {
        if (!cancelled) {
          window.clearInterval(intervalId);
          setJobError('Could not check job status. Please try again.');
        }
      }
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // Re-subscribe only when the active job ID, status, or report period changes.
    // Progress changes alone should not restart the polling interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.jobId, job?.status, requestKey]);

  const handleGenerateAsync = async () => {
    setIsSubmittingJob(true);
    setJobError(null);
    try {
      const reportDate =
        tab === 'daily'
          ? inputValueToApiDate(dailyDate)
          : tab === 'month-to-date'
            ? inputValueToApiDate(mtdDate)
            : undefined;

      const submission = await submitReportJob({
        reportType: tab,
        ...(reportDate ? { date: reportDate } : {}),
      });

      setJob({
        jobId: submission.jobId,
        status: submission.status,
        progress: null,
      });
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Failed to queue report generation.');
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const retry = () => setReloadNonce((nonce) => nonce + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Averages over your own recorded readings — never an average of daily averages.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerateAsync}
          disabled={
            job !== null &&
            (job.status === 'waiting' || job.status === 'active' || job.status === 'delayed')
          }
          loading={isSubmittingJob}
        >
          Generate in background
        </Button>
      </div>

      {job || jobError ? (
        <Card className="border-olive/30 bg-sage/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-olive-dark">
                  Background Job
                </span>
                {job?.status && (
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      job.status === 'completed'
                        ? 'bg-olive-dark text-cream'
                        : job.status === 'failed'
                          ? 'bg-terracotta text-cream'
                          : 'bg-olive/20 text-olive-dark'
                    }`}
                  >
                    {job.status === 'waiting'
                      ? 'Queued (waiting)'
                      : job.status === 'active'
                        ? 'Processing'
                        : job.status}
                  </span>
                )}
              </div>
              {job?.jobId && <p className="font-mono text-xs text-ink-soft">Job ID: {job.jobId}</p>}
              {job?.progress !== null && job?.progress !== undefined && (
                <p className="text-xs text-ink-soft">Progress: {job.progress}%</p>
              )}
              {job?.status === 'failed' && (
                <p className="text-xs text-terracotta">
                  {job.failedReason ?? 'Report generation failed in worker.'}
                </p>
              )}
              {jobError && <p className="text-xs text-terracotta">{jobError}</p>}
            </div>

            <div className="flex items-center gap-2">
              {job?.status === 'completed' ? (
                <span className="text-xs font-medium text-olive-dark">
                  ✓ Report ready &amp; loaded
                </span>
              ) : job?.status === 'waiting' || job?.status === 'active' ? (
                <div className="flex items-center gap-2 text-xs text-ink-soft">
                  <Spinner className="size-3.5 text-olive" />
                  <span>Generating…</span>
                </div>
              ) : null}

              {(job?.status === 'completed' || job?.status === 'failed' || jobError) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setJob(null);
                    setJobError(null);
                  }}
                  aria-label="Dismiss background job notice"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <div
        role="tablist"
        aria-label="Report period"
        className="flex w-fit gap-1 rounded-xl border border-line bg-surface p-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 ${
              tab === item.id
                ? 'bg-olive-dark text-cream'
                : 'text-ink-soft hover:bg-sage/50 hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${tab}-${dailyDate}-${mtdDate}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          {loading ? (
            <LoadingState label="Loading report" className="py-20" />
          ) : error ? (
            <Card>
              <p className="py-8 text-center text-sm text-ink-soft">
                We couldn't load this report.
              </p>
              <div className="flex justify-center">
                <Button variant="secondary" onClick={retry}>
                  Try again
                </Button>
              </div>
            </Card>
          ) : tab === 'daily' && state.daily ? (
            <DailyReportView
              report={state.daily}
              dateValue={dailyDate}
              onDateChange={setDailyDate}
            />
          ) : tab !== 'daily' && state.period ? (
            <PeriodReportView
              report={state.period}
              readings={state.periodReadings}
              showDatePicker={tab === 'month-to-date'}
              dateValue={mtdDate}
              onDateChange={setMtdDate}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function DailyReportView({
  report,
  dateValue,
  onDateChange,
}: {
  report: DailyReport;
  dateValue: string;
  onDateChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {formatLongDate(report.date)}
          </h2>
          <div className="w-44">
            <Field label="Report date">
              {(fieldProps) => (
                <Input
                  fieldProps={fieldProps}
                  type="date"
                  value={dateValue}
                  max={apiDateToInputValue(todayApiDate())}
                  onChange={(event) => onDateChange(event.target.value)}
                />
              )}
            </Field>
          </div>
        </div>
        <div className="mt-5">
          <ReportSummaryStats summary={report.summary} />
        </div>
      </Card>

      {report.readings.length > 0 ? (
        <>
          <Card>
            <GlucoseTrendChart readings={report.readings} />
          </Card>
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
              {/* Bar chart — ~65% */}
              <div className="min-w-0 lg:flex-[65]">
                <h3 className="text-sm font-semibold text-ink">This day's readings (mg/dL)</h3>
                <div className="mt-4">
                  <ValueBars
                    points={report.readings.map((reading) => ({
                      label: slotShortLabel(reading.slot),
                      value: reading.value,
                    }))}
                    average={report.summary.average}
                    title="Glucose values by reading slot for this day"
                    animate
                  />
                </div>
              </div>
              {/* Donut chart — ~35% */}
              <div className="shrink-0 lg:flex-[35]">
                <h3 className="text-sm font-semibold text-ink">Readings by time slot</h3>
                <div className="mt-4">
                  <SlotDonutChart counts={slotCounts(report.readings)} />
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-ink">Recorded readings</h3>
            <div className="mt-3">
              <ReadingsList readings={report.readings.map(asReading)} />
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <p className="py-8 text-center text-sm text-ink-soft">
            No readings recorded on this day.
          </p>
        </Card>
      )}
    </div>
  );
}

export function PeriodReportView({
  report,
  readings,
  showDatePicker,
  dateValue,
  onDateChange,
}: {
  report: PeriodReport;
  readings: Reading[];
  showDatePicker: boolean;
  dateValue: string;
  onDateChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {formatPeriodLabel(report.period.startDate, report.period.endDate)}
          </h2>
          {showDatePicker ? (
            <div className="w-44">
              <Field label="Report date">
                {(fieldProps) => (
                  <Input
                    fieldProps={fieldProps}
                    type="date"
                    value={dateValue}
                    max={apiDateToInputValue(todayApiDate())}
                    onChange={(event) => onDateChange(event.target.value)}
                  />
                )}
              </Field>
            </div>
          ) : null}
        </div>
        <div className="mt-5">
          <ReportSummaryStats summary={report.summary} />
        </div>
      </Card>

      {readings.length > 0 ? (
        <>
          <Card>
            <GlucoseTrendChart readings={readings} />
          </Card>
          <Card>
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
              {/* Bar chart — ~65% */}
              <div className="min-w-0 lg:flex-[65]">
                <h3 className="text-sm font-semibold text-ink">
                  Daily averages (mg/dL) — only days with readings
                </h3>
                <div className="mt-4">
                  <ValueBars
                    points={dailyAveragePoints(readings)}
                    average={report.summary.average}
                    title="Average glucose per day across the report period"
                    animate
                  />
                </div>
              </div>
              {/* Donut chart — ~35% */}
              <div className="shrink-0 lg:flex-[35]">
                <h3 className="text-sm font-semibold text-ink">Readings by time slot</h3>
                <div className="mt-4">
                  <SlotDonutChart counts={slotCounts(readings)} />
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <p className="py-8 text-center text-sm text-ink-soft">
            No readings recorded in this period.
          </p>
        </Card>
      )}
    </div>
  );
}

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
