import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  getPatientDailyReport,
  getPatientMonthToDateReport,
  getPatientMonthlyReport,
  listAllPatientReadings,
  listPatientReadings,
  listPatients,
  type PatientSummary,
} from '../services/doctorApi.js';
import type { DailyReport, PeriodReport } from '../types/report.js';
import type { PaginatedReadings, Reading } from '../types/reading.js';
import { apiDateToInputValue, inputValueToApiDate, todayApiDate } from '../lib/date.js';
import { Button, LoadingState } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Field, Input } from '../components/ui/Input.js';
import { ReadingsList } from '../components/readings/ReadingsList.js';
import { ReadingsPagination } from '../components/readings/ReadingsPagination.js';
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
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [period, setPeriod] = useState<PeriodReport | null>(null);
  const [periodReadings, setPeriodReadings] = useState<Reading[]>([]);

  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

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

  const requestKey = `${patientId}|${tab}|${dailyDate}|${mtdDate}|${dateFilter}|${page}|${pageSize}|${reloadNonce}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!patientId) return;

    let cancelled = false;
    const key = `${patientId}|${tab}|${dailyDate}|${mtdDate}|${dateFilter}|${page}|${pageSize}|${reloadNonce}`;

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
              : await getPatientMonthlyReport(patientId);
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
  }, [patientId, tab, dailyDate, mtdDate, dateFilter, page, pageSize, reloadNonce]);

  if (!patientId) {
    return <Navigate to="/patients" replace />;
  }

  const retry = () => setReloadNonce((nonce) => nonce + 1);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/patients"
          className="text-sm font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
        >
          ← All patients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {patient?.name ?? 'Patient'}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {patient?.email ? `${patient.email} · ` : ''}Read-only access granted by the patient.
        </p>
      </div>

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
          showDatePicker={tab === 'month-to-date'}
          dateValue={mtdDate}
          onDateChange={setMtdDate}
        />
      ) : null}
    </div>
  );
}
