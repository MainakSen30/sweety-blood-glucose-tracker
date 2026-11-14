import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './ReportsPage.js';
import * as reportsApi from '../services/reportsApi.js';
import * as readingsApi from '../services/readingsApi.js';
import type { DailyReport, PeriodReport } from '../types/report.js';
import type { Reading, ReadingSlot } from '../types/reading.js';
import { todayApiDate } from '../lib/date.js';

vi.mock('../services/reportsApi', () => ({
  getDailyReport: vi.fn(),
  getMonthToDateReport: vi.fn(),
  getMonthlyReport: vi.fn(),
}));

vi.mock('../services/readingsApi', () => ({
  listAllReadings: vi.fn(),
}));

afterEach(cleanup);

function reading(id: string, readingDate: string, slot: ReadingSlot, value: number): Reading {
  return {
    id,
    userId: 'user-1',
    readingDate,
    slot,
    value,
    createdAt: '2026-11-12T10:30:00.000Z',
    updatedAt: '2026-11-12T10:30:00.000Z',
  };
}

const DAILY_READINGS = [
  reading('d1', '12-11-2026', 'morning', 95),
  reading('d2', '12-11-2026', 'after_breakfast', 145),
  reading('d3', '12-11-2026', 'after_lunch', 130),
  reading('d4', '12-11-2026', 'after_dinner', 118),
];

const DAILY_REPORT: DailyReport = {
  reportType: 'daily',
  date: '12-11-2026',
  summary: { highest: 145, lowest: 95, average: 122, totalReadings: 4 },
  readings: DAILY_READINGS,
};

const MTD_READINGS = [
  reading('m1', '01-11-2026', 'morning', 90),
  reading('m2', '05-11-2026', 'after_lunch', 180),
  reading('m3', '10-11-2026', 'morning', 100),
  reading('m4', '10-11-2026', 'after_lunch', 120),
  reading('m5', '12-11-2026', 'after_breakfast', 140),
  reading('m6', '12-11-2026', 'after_dinner', 160),
];

const MTD_REPORT: PeriodReport = {
  reportType: 'month-to-date',
  period: { startDate: '01-11-2026', endDate: '12-11-2026' },
  summary: { highest: 180, lowest: 90, average: 131.7, totalReadings: 6 },
};

const MONTHLY_READINGS = [
  reading('p1', '01-10-2026', 'morning', 110),
  reading('p2', '31-10-2026', 'after_dinner', 130),
];

const MONTHLY_REPORT: PeriodReport = {
  reportType: 'monthly',
  period: { startDate: '01-10-2026', endDate: '31-10-2026' },
  summary: { highest: 130, lowest: 110, average: 120, totalReadings: 2 },
};

const SINGLE_READING_REPORT: PeriodReport = {
  reportType: 'month-to-date',
  period: { startDate: '01-11-2026', endDate: '05-11-2026' },
  summary: { highest: 180, lowest: 180, average: 180, totalReadings: 1 },
};

const EMPTY_REPORT: PeriodReport = {
  reportType: 'month-to-date',
  period: { startDate: '01-11-2026', endDate: '12-11-2026' },
  summary: { highest: null, lowest: null, average: null, totalReadings: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportsApi.getDailyReport).mockResolvedValue(DAILY_REPORT);
  vi.mocked(reportsApi.getMonthToDateReport).mockResolvedValue(MTD_REPORT);
  vi.mocked(reportsApi.getMonthlyReport).mockResolvedValue(MONTHLY_REPORT);
  vi.mocked(readingsApi.listAllReadings).mockResolvedValue(MTD_READINGS);
});

describe('ReportsPage charts', () => {
  it('renders the daily trend, slot donut, and existing bar chart', async () => {
    render(<ReportsPage />);

    expect(
      await screen.findByRole('heading', { name: '12 November 2026', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Glucose trends' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Glucose values by reading slot for this day' }),
    ).toBeInTheDocument();

    const trend = screen.getByRole('group', { name: 'Glucose trends chart' });
    expect(within(trend).getAllByRole('button')).toHaveLength(4);

    const legend = screen.getByLabelText('Reading slot breakdown');
    expect(within(legend).getAllByText('1')).toHaveLength(4);
    expect(within(legend).getAllByText('25.0%')).toHaveLength(4);
  });

  it('loads individual readings for the month-to-date report and keeps the bar chart', async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('tab', { name: 'Month to date' }));

    expect(
      await screen.findByRole('heading', { name: '1–12 November 2026', level: 2 }),
    ).toBeInTheDocument();
    expect(reportsApi.getMonthToDateReport).toHaveBeenCalledWith(todayApiDate());
    expect(readingsApi.listAllReadings).toHaveBeenCalledWith({
      from: '01-11-2026',
      to: '12-11-2026',
    });
    expect(
      screen.getByRole('img', { name: 'Average glucose per day across the report period' }),
    ).toBeInTheDocument();

    const trend = screen.getByRole('group', { name: 'Glucose trends chart' });
    expect(within(trend).getAllByRole('button')).toHaveLength(6);

    const legend = screen.getByLabelText('Reading slot breakdown');
    // Morning 2, after breakfast 1, after lunch 2, after dinner 1.
    expect(within(legend).getAllByText('2')).toHaveLength(2);
    expect(within(legend).getAllByText('1')).toHaveLength(2);
    expect(within(legend).getAllByText('33.3%')).toHaveLength(2);
    expect(within(legend).getAllByText('16.7%')).toHaveLength(2);
  });

  it('updates both charts when the report date changes', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.getMonthToDateReport).mockImplementation(async (date) =>
      date === '05-11-2026' ? SINGLE_READING_REPORT : MTD_REPORT,
    );
    vi.mocked(readingsApi.listAllReadings).mockImplementation(async ({ to } = {}) =>
      to === '05-11-2026' ? [MTD_READINGS[1] as Reading] : MTD_READINGS,
    );

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });
    await user.click(screen.getByRole('tab', { name: 'Month to date' }));
    await screen.findByRole('heading', { name: '1–12 November 2026', level: 2 });

    fireEvent.change(screen.getByLabelText('Report date'), {
      target: { value: '2026-11-05' },
    });

    expect(
      await screen.findByRole('heading', { name: '1–5 November 2026', level: 2 }),
    ).toBeInTheDocument();
    expect(reportsApi.getMonthToDateReport).toHaveBeenLastCalledWith('05-11-2026');
    expect(readingsApi.listAllReadings).toHaveBeenLastCalledWith({
      from: '01-11-2026',
      to: '05-11-2026',
    });

    const trend = screen.getByRole('group', { name: 'Glucose trends chart' });
    expect(within(trend).getAllByRole('button')).toHaveLength(1);
    // A single observation has no connecting line.
    expect(trend.querySelector('polyline')).toBeNull();

    const legend = screen.getByLabelText('Reading slot breakdown');
    expect(within(legend).getByText('100.0%')).toBeInTheDocument();
  });

  it('switches to the previous-month report and updates the charts', async () => {
    const user = userEvent.setup();
    vi.mocked(readingsApi.listAllReadings).mockResolvedValue(MONTHLY_READINGS);
    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('tab', { name: 'Previous month' }));

    expect(
      await screen.findByRole('heading', { name: '1–31 October 2026', level: 2 }),
    ).toBeInTheDocument();
    expect(readingsApi.listAllReadings).toHaveBeenCalledWith({
      from: '01-10-2026',
      to: '31-10-2026',
    });
    const trend = screen.getByRole('group', { name: 'Glucose trends chart' });
    expect(within(trend).getAllByRole('button')).toHaveLength(2);
    expect(within(trend).getByText('01 Oct')).toBeInTheDocument();
    expect(within(trend).getByText('31 Oct')).toBeInTheDocument();
  });

  it('updates the previous-month report when a historical date is selected', async () => {
    const user = userEvent.setup();
    const HISTORICAL_MONTHLY_REPORT: PeriodReport = {
      reportType: 'monthly',
      period: { startDate: '01-09-2026', endDate: '30-09-2026' },
      summary: { highest: 150, lowest: 90, average: 120, totalReadings: 2 },
    };
    vi.mocked(reportsApi.getMonthlyReport).mockImplementation(async (date) =>
      date === '15-10-2026' ? HISTORICAL_MONTHLY_REPORT : MONTHLY_REPORT,
    );
    vi.mocked(readingsApi.listAllReadings).mockResolvedValue(MONTHLY_READINGS);

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('tab', { name: 'Previous month' }));
    expect(
      await screen.findByRole('heading', { name: '1–31 October 2026', level: 2 }),
    ).toBeInTheDocument();
    expect(reportsApi.getMonthlyReport).toHaveBeenLastCalledWith(todayApiDate());

    // Change date in date picker on the monthly report tab to 2026-10-15
    fireEvent.change(screen.getByLabelText('Report date'), {
      target: { value: '2026-10-15' },
    });

    expect(
      await screen.findByRole('heading', { name: '1–30 September 2026', level: 2 }),
    ).toBeInTheDocument();
    expect(reportsApi.getMonthlyReport).toHaveBeenLastCalledWith('15-10-2026');
    expect(readingsApi.listAllReadings).toHaveBeenLastCalledWith({
      from: '01-09-2026',
      to: '30-09-2026',
    });
  });

  it('shows the empty state and no charts when the period has no readings', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.getMonthToDateReport).mockResolvedValue(EMPTY_REPORT);
    vi.mocked(readingsApi.listAllReadings).mockResolvedValue([]);

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });
    await user.click(screen.getByRole('tab', { name: 'Month to date' }));

    expect(await screen.findByText('No readings recorded in this period.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Glucose trends' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reading slot breakdown')).not.toBeInTheDocument();
  });

  it('shows an error with a retry action instead of stale chart data', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.getDailyReport).mockRejectedValueOnce(new Error('network'));

    render(<ReportsPage />);

    expect(await screen.findByText("We couldn't load this report.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Glucose trends' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Glucose trends' })).toBeInTheDocument();
  });

  it('reserves space with a labelled loading state', () => {
    vi.mocked(reportsApi.getDailyReport).mockReturnValue(new Promise(() => {}));

    render(<ReportsPage />);

    expect(screen.getByRole('status', { name: 'Loading report' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Glucose trends' })).not.toBeInTheDocument();
  });

  it('never shows the previous period while the new tab is loading', async () => {
    const user = userEvent.setup();
    let resolveMtd: (value: PeriodReport) => void = () => {};
    vi.mocked(reportsApi.getMonthToDateReport).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMtd = resolve;
      }),
    );

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('tab', { name: 'Month to date' }));

    expect(await screen.findByRole('status', { name: 'Loading report' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '12 November 2026', level: 2 }),
    ).not.toBeInTheDocument();

    resolveMtd(MTD_REPORT);
    expect(
      await screen.findByRole('heading', { name: '1–12 November 2026', level: 2 }),
    ).toBeInTheDocument();
  });

  it('renders the four slot categories from actual counts', async () => {
    render(<ReportsPage />);
    await screen.findByRole('heading', { name: 'Glucose trends' });

    const legend = screen.getByLabelText('Reading slot breakdown');
    expect(within(legend).getByText('Morning')).toBeInTheDocument();
    expect(within(legend).getByText('After breakfast')).toBeInTheDocument();
    expect(within(legend).getByText('After lunch')).toBeInTheDocument();
    expect(within(legend).getByText('After dinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total readings')).toBeInTheDocument();
    });
  });
});
