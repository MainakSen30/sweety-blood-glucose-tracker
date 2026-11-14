import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './ReportsPage.js';
import * as reportsApi from '../services/reportsApi.js';
import * as readingsApi from '../services/readingsApi.js';
import type { DailyReport } from '../types/report.js';

vi.mock('../services/reportsApi', () => ({
  getDailyReport: vi.fn(),
  getMonthToDateReport: vi.fn(),
  getMonthlyReport: vi.fn(),
  submitReportJob: vi.fn(),
  getReportJobStatus: vi.fn(),
  getReportJobResult: vi.fn(),
}));

vi.mock('../services/readingsApi', () => ({
  listAllReadings: vi.fn(),
}));

afterEach(cleanup);

const SYNC_DAILY_REPORT: DailyReport = {
  reportType: 'daily',
  date: '12-11-2026',
  summary: { highest: 145, lowest: 95, average: 122, totalReadings: 4 },
  readings: [
    { id: 'd1', readingDate: '12-11-2026', slot: 'morning', value: 95 },
    { id: 'd2', readingDate: '12-11-2026', slot: 'after_breakfast', value: 145 },
  ],
};

const ASYNC_COMPLETED_REPORT: DailyReport = {
  reportType: 'daily',
  date: '12-11-2026',
  summary: { highest: 180, lowest: 90, average: 135, totalReadings: 2 },
  readings: [
    { id: 'a1', readingDate: '12-11-2026', slot: 'morning', value: 90 },
    { id: 'a2', readingDate: '12-11-2026', slot: 'after_lunch', value: 180 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportsApi.getDailyReport).mockResolvedValue(SYNC_DAILY_REPORT);
  vi.mocked(readingsApi.listAllReadings).mockResolvedValue([]);
});

describe('ReportsPage — Asynchronous Background Jobs', () => {
  it('submits a background job when "Generate in background" is clicked and displays queued status', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.submitReportJob).mockResolvedValueOnce({
      jobId: 'rpt:test-job-1',
      status: 'waiting',
    });

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    const generateButton = screen.getByRole('button', { name: 'Generate in background' });
    await user.click(generateButton);

    expect(reportsApi.submitReportJob).toHaveBeenCalledWith(
      expect.objectContaining({ reportType: 'daily' }),
    );

    expect(await screen.findByText('Job ID: rpt:test-job-1')).toBeInTheDocument();
    expect(screen.getByText('Queued (waiting)')).toBeInTheDocument();
  });

  it('polls status, updates progress, and renders completed result once finished', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.submitReportJob).mockResolvedValueOnce({
      jobId: 'rpt:test-job-2',
      status: 'waiting',
    });

    let pollCount = 0;
    vi.mocked(reportsApi.getReportJobStatus).mockImplementation(async () => {
      pollCount++;
      if (pollCount === 1) {
        return { jobId: 'rpt:test-job-2', status: 'active', progress: 50 };
      }
      return { jobId: 'rpt:test-job-2', status: 'completed', progress: 100 };
    });

    vi.mocked(reportsApi.getReportJobResult).mockResolvedValueOnce(ASYNC_COMPLETED_REPORT);

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('button', { name: 'Generate in background' }));

    // Verify progress update arrives
    expect(await screen.findByText('Progress: 50%', {}, { timeout: 3500 })).toBeInTheDocument();

    // Verify completion status and banner
    expect(
      await screen.findByText('✓ Report ready & loaded', {}, { timeout: 3500 }),
    ).toBeInTheDocument();
    expect(reportsApi.getReportJobResult).toHaveBeenCalledWith('rpt:test-job-2');

    // Polling must stop after completion
    const callsAtCompletion = vi.mocked(reportsApi.getReportJobStatus).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(vi.mocked(reportsApi.getReportJobStatus).mock.calls.length).toBe(callsAtCompletion);
  });

  it('displays understandable feedback when job fails in background and stops polling', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.submitReportJob).mockResolvedValueOnce({
      jobId: 'rpt:test-job-3',
      status: 'waiting',
    });

    vi.mocked(reportsApi.getReportJobStatus).mockResolvedValue({
      jobId: 'rpt:test-job-3',
      status: 'failed',
      progress: null,
      failedReason: 'PostgreSQL connection timeout in background worker.',
    });

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('button', { name: 'Generate in background' }));

    expect(
      await screen.findByText(
        'PostgreSQL connection timeout in background worker.',
        {},
        { timeout: 3500 },
      ),
    ).toBeInTheDocument();

    // Polling must stop after failure
    const callsAtFailure = vi.mocked(reportsApi.getReportJobStatus).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(vi.mocked(reportsApi.getReportJobStatus).mock.calls.length).toBe(callsAtFailure);
  });

  it('handles submission errors gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.submitReportJob).mockRejectedValueOnce(
      new Error('Report queue is unavailable. Please try again later.'),
    );

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('button', { name: 'Generate in background' }));

    expect(
      await screen.findByText('Report queue is unavailable. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('allows dismissing the completed/failed background job notice', async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.submitReportJob).mockResolvedValueOnce({
      jobId: 'rpt:test-job-dismiss',
      status: 'completed',
    });
    vi.mocked(reportsApi.getReportJobResult).mockResolvedValueOnce(ASYNC_COMPLETED_REPORT);

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('button', { name: 'Generate in background' }));

    const dismissButton = await screen.findByRole('button', {
      name: 'Dismiss background job notice',
    });
    await user.click(dismissButton);

    expect(screen.queryByText('Job ID: rpt:test-job-dismiss')).not.toBeInTheDocument();
  });

  it('submits a monthly background report job with the selected historical date', async () => {
    const user = userEvent.setup();
    const MONTHLY_ASYNC_REPORT = {
      reportType: 'monthly' as const,
      period: { startDate: '01-09-2026', endDate: '30-09-2026' },
      summary: { highest: 160, lowest: 80, average: 120, totalReadings: 2 },
    };
    vi.mocked(reportsApi.getMonthlyReport).mockResolvedValueOnce(MONTHLY_ASYNC_REPORT);
    vi.mocked(reportsApi.submitReportJob).mockResolvedValueOnce({
      jobId: 'rpt:monthly-job-1',
      status: 'waiting',
    });

    render(<ReportsPage />);
    await screen.findByRole('heading', { name: '12 November 2026', level: 2 });

    await user.click(screen.getByRole('tab', { name: 'Previous month' }));
    await screen.findByRole('heading', { name: '1–30 September 2026', level: 2 });

    // Change date in date picker on the monthly report tab to 2026-10-15
    fireEvent.change(screen.getByLabelText('Report date'), {
      target: { value: '2026-10-15' },
    });

    const generateButton = screen.getByRole('button', { name: 'Generate in background' });
    await user.click(generateButton);

    expect(reportsApi.submitReportJob).toHaveBeenCalledWith({
      reportType: 'monthly',
      date: '15-10-2026',
    });
    expect(await screen.findByText('Job ID: rpt:monthly-job-1')).toBeInTheDocument();
  });
});
