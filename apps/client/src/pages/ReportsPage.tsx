import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getDailyReport, getMonthlyReport, getMonthToDateReport } from '../services/reportsApi.js';
import { listAllReadings } from '../services/readingsApi.js';
import type { DailyReport, PeriodReport } from '../types/report.js';
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
import { Button, Spinner } from '../components/ui/Button.js';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

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
        }
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
  }, [tab, dailyDate, mtdDate, reloadNonce]);

  const retry = () => {
    setLoading(true);
    setReloadNonce((nonce) => nonce + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Reports</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Averages over your own recorded readings — never an average of daily averages.
        </p>
      </div>

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
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          {loading ? (
            <div role="status" aria-label="Loading report" className="flex justify-center py-20">
              <Spinner className="size-6 text-olive" />
            </div>
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

function DailyReportView({
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

function PeriodReportView({
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
