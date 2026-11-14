import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  getPatientDailyReport,
  getPatientMonthToDateReport,
  getPatientMonthlyReport,
  getPatientReportJobStatus,
  listAllPatientReadings,
  listPatientReadings,
  listPatients,
  submitPatientReportJob,
  type PatientSummary,
} from '../services/doctorApi.js';
import type { DailyReport, PeriodReport, ReportJobStatus } from '../types/report.js';
import type { PaginatedReadings, Reading } from '../types/reading.js';
import { apiDateToInputValue, inputValueToApiDate, todayApiDate } from '../lib/date.js';
import { Button, LoadingState, Spinner } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { ReadonlyPill } from '../components/doctor/DoctorUi.js';
import { ReadingsList } from '../components/readings/ReadingsList.js';
import { ReadingsPagination } from '../components/readings/ReadingsPagination.js';
import { ArrowLeftIcon } from '../components/ui/icons.js';
import { DailyReportView, PeriodReportView } from './ReportsPage.js';

type PatientTab = 'readings' | 'daily' | 'month-to-date' | 'monthly';

const TABS: Array<{ id: PatientTab; label: string }> = [
  { id: 'readings', label: 'Readings' },
  { id: 'daily', label: 'Daily' },
  { id: 'month-to-date', label: 'Month to date' },
  { id: 'monthly', label: 'Previous month' },
];

const DEFAULT_PAGE_SIZE = 20;

/**
 * Read-only view of a consented patient's readings and reports. Every request
 * goes through `/api/doctor/patients/:id/*`, which re-checks the active
 * assignment, so a revoked patient simply stops loading.
 */
export default function DoctorPatientPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [tab, setTab] = useState<PatientTab>('readings');

  const [readings, setReadings] = useState<PaginatedReadings | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [dailyDate, setDailyDate] = useState(apiDateToInputValue(todayApiDate()));
  const [mtdDate, setMtdDate] = useState(apiDateToInputValue(todayApiDate()));
  const [monthlyDate, setMonthlyDate] = useState(apiDateToInputValue(todayApiDate()));
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [period, setPeriod] = useState<PeriodReport | null>(null);
  const [periodReadings, setPeriodReadings] = useState<Reading[]>([]);

  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [job, setJob] = useState<ReportJobStatus | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    let cancelled = false;

    void (async () => {
      try {
        const links = await listPatients();
        if (cancelled) return;
        setPatient(links.find((link) => link.patient.id === patientId)?.patient ?? null);
      } catch {
        // The tab content reports the failure; the header stays quiet.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const requestKey = `${patientId}|${tab}|${dailyDate}|${mtdDate}|${monthlyDate}|${dateFilter}|${page}|${pageSize}|${reloadNonce}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!patientId) return;

    let cancelled = false;
    const key = `${patientId}|${tab}|${dailyDate}|${mtdDate}|${monthlyDate}|${dateFilter}|${page}|${pageSize}|${reloadNonce}`;

    void (async () => {
      try {
        if (tab === 'readings') {
          const next = await listPatientReadings(patientId, {
            page,
            limit: pageSize,
            ...(dateFilter ? { date: inputValueToApiDate(dateFilter) } : {}),
          });

          if (cancelled) return;

          // Deleting readings is impossible here, but a revoked-then-restored
          // dataset can still shrink; clamp instead of showing an empty page.
          if (next.pagination.totalPages > 0 && page > next.pagination.totalPages) {
            setPage(next.pagination.totalPages);
            return;
          }

          setReadings(next);
          setDaily(null);
          setPeriod(null);
          setPeriodReadings([]);
        } else if (tab === 'daily') {
          setReadings(null);
          setDaily(await getPatientDailyReport(patientId, inputValueToApiDate(dailyDate)));
          setPeriod(null);
          setPeriodReadings([]);
        } else {
          setReadings(null);
          const next =
            tab === 'month-to-date'
              ? await getPatientMonthToDateReport(patientId, inputValueToApiDate(mtdDate))
              : await getPatientMonthlyReport(patientId, inputValueToApiDate(monthlyDate));
          const nextReadings = await listAllPatientReadings(patientId, {
            from: next.period.startDate,
            to: next.period.endDate,
          });
          if (cancelled) return;
          setDaily(null);
          setPeriod(next);
          setPeriodReadings(nextReadings);
        }

        if (!cancelled) {
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
  }, [patientId, tab, dailyDate, mtdDate, monthlyDate, dateFilter, page, pageSize, reloadNonce]);

  const jobId = job?.jobId;
  const jobStatus = job?.status;

  useEffect(() => {
    if (!patientId || !jobId || !jobStatus) return;
    if (jobStatus === 'completed' || jobStatus === 'failed') return;

    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      try {
        const status = await getPatientReportJobStatus(patientId, jobId);
        if (cancelled) return;
        setJob((previous) => (previous ? { ...previous, ...status } : status));

        if (status.status === 'completed') {
          window.clearInterval(intervalId);
          // Re-run the visible tab's normal fetch instead of trusting the job
          // payload; the report endpoint remains the source of truth.
          setReloadNonce((nonce) => nonce + 1);
        } else if (status.status === 'failed') {
          window.clearInterval(intervalId);
        }
      } catch {
        if (!cancelled) {
          window.clearInterval(intervalId);
          setJobError('Could not check job status. Try again.');
        }
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [patientId, jobId, jobStatus]);

  if (!patientId) {
    return <Navigate to="/doctor/patients" replace />;
  }

  const retry = () => setReloadNonce((nonce) => nonce + 1);

  async function handleGenerate() {
    if (!patientId || tab === 'readings') return;

    setIsSubmittingJob(true);
    setJobError(null);

    try {
      const date =
        tab === 'monthly' ? undefined : inputValueToApiDate(tab === 'daily' ? dailyDate : mtdDate);
      const submission = await submitPatientReportJob(patientId, {
        reportType: tab,
        ...(date ? { date } : {}),
      });
      setJob({ jobId: submission.jobId, status: submission.status, progress: null });
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Could not queue report generation.');
    } finally {
      setIsSubmittingJob(false);
    }
  }

  const jobActive =
    job !== null &&
    (job.status === 'waiting' || job.status === 'active' || job.status === 'delayed');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/doctor/patients"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
          >
            <ArrowLeftIcon className="size-3.5" />
            All patients
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {patient?.name ?? 'Patient'}
            </h1>
            <ReadonlyPill />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {patient?.email ? `${patient.email} · ` : ''}Read-only access granted by the patient.
          </p>
        </div>

        {tab !== 'readings' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleGenerate()}
            disabled={jobActive}
            loading={isSubmittingJob}
          >
            Generate in background
          </Button>
        ) : null}
      </div>

      {job || jobError ? (
        <Card className="border-olive/30 bg-sage/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-olive-dark">Background report</span>
                {job ? (
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                      job.status === 'completed'
                        ? 'bg-olive-dark text-cream'
                        : job.status === 'failed'
                          ? 'bg-terracotta text-cream'
                          : 'bg-olive/20 text-olive-dark'
                    }`}
                  >
                    {job.status === 'waiting'
                      ? 'Queued'
                      : job.status === 'active'
                        ? 'Processing'
                        : job.status}
                  </span>
                ) : null}
              </div>
              {job?.jobId ? (
                <p className="font-mono text-xs text-ink-soft">Job ID: {job.jobId}</p>
              ) : null}
              {job?.progress !== null && job?.progress !== undefined ? (
                <p className="text-xs text-ink-soft">Progress: {job.progress}%</p>
              ) : null}
              {job?.status === 'failed' ? (
                <p className="text-xs text-terracotta-ink">
                  {job.failedReason ?? 'Report generation failed.'}
                </p>
              ) : null}
              {jobError ? <p className="text-xs text-terracotta-ink">{jobError}</p> : null}
            </div>

            <div className="flex items-center gap-2">
              {jobActive ? (
                <span className="flex items-center gap-2 text-xs text-ink-soft">
                  <Spinner className="size-3.5 text-olive" />
                  Generating
                </span>
              ) : job?.status === 'completed' ? (
                <span className="text-xs font-medium text-olive-dark">Report refreshed</span>
              ) : null}
              {!jobActive && (job || jobError) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setJob(null);
                    setJobError(null);
                  }}
                >
                  Dismiss
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <div
        role="tablist"
        aria-label="Patient data"
        className="flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
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

      {loading ? (
        <LoadingState label="Loading patient data" className="py-20" />
      ) : error ? (
        <Card>
          <p className="py-8 text-center text-sm text-ink-soft">
            We couldn't load this patient's data. Access may have been revoked.
          </p>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          </div>
        </Card>
      ) : tab === 'readings' && readings ? (
        <Card>
          <Field label="Filter by date" hint="Leave empty to see the full history.">
            {(fieldProps) => (
              <Input
                fieldProps={fieldProps}
                type="date"
                value={dateFilter}
                max={apiDateToInputValue(todayApiDate())}
                onChange={(event) => {
                  setLoadedKey(null);
                  setPage(1);
                  setDateFilter(event.target.value);
                }}
                className="max-w-56"
              />
            )}
          </Field>

          <div className="mt-5">
            {readings.data.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-soft">
                {dateFilter ? 'No readings on this date.' : 'This patient has no readings yet.'}
              </p>
            ) : (
              <ReadingsList readings={readings.data} />
            )}

            <ReadingsPagination
              pagination={readings.pagination}
              pageSize={pageSize}
              onPageChange={(nextPage) => {
                setLoadedKey(null);
                setPage(nextPage);
              }}
              onPageSizeChange={(nextSize) => {
                setLoadedKey(null);
                setPage(1);
                setPageSize(nextSize);
              }}
            />
          </div>
        </Card>
      ) : tab === 'daily' && daily ? (
        <DailyReportView report={daily} dateValue={dailyDate} onDateChange={setDailyDate} />
      ) : tab !== 'readings' && tab !== 'daily' && period ? (
        <PeriodReportView
          report={period}
          readings={periodReadings}
          showDatePicker={true}
          dateValue={tab === 'month-to-date' ? mtdDate : monthlyDate}
          onDateChange={tab === 'month-to-date' ? setMtdDate : setMonthlyDate}
        />
      ) : null}
    </div>
  );
}
