import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReadingsPage from './ReadingsPage.js';
import * as readingsApi from '../services/readingsApi.js';
import type { PaginatedReadings, Reading } from '../types/reading.js';

vi.mock('../services/readingsApi', () => ({
  listReadings: vi.fn(),
  createReading: vi.fn(),
  updateReading: vi.fn(),
  deleteReading: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReading(id: string, value = 100): Reading {
  return {
    id,
    userId: 'user-1',
    readingDate: '12-11-2026',
    slot: 'morning',
    value,
    createdAt: '2026-11-12T10:30:00.000Z',
    updatedAt: '2026-11-12T10:30:00.000Z',
  };
}

function makePage({
  page = 1,
  limit = 20,
  total = 45,
  data,
}: {
  page?: number;
  limit?: number;
  total?: number;
  data?: Reading[];
} = {}): PaginatedReadings {
  const count = Math.max(0, Math.min(limit, total - (page - 1) * limit));
  const totalPages = Math.ceil(total / limit);
  const readings =
    data ??
    Array.from({ length: count }, (_, index) =>
      makeReading(`reading-${page}-${index}`, 100 + index),
    );

  return {
    data: readings,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: total > 0 && page > 1,
    },
  };
}

describe('ReadingsPage pagination', () => {
  it('renders the range and page controls, with Previous disabled on page 1', async () => {
    vi.mocked(readingsApi.listReadings).mockResolvedValue(makePage());

    render(<ReadingsPage />);

    expect(await screen.findByText('Showing 1–20 of 45 readings')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('requests the next page and then the previous page', async () => {
    const user = userEvent.setup();
    vi.mocked(readingsApi.listReadings).mockImplementation(async ({ page = 1, limit = 20 } = {}) =>
      makePage({ page, limit }),
    );

    render(<ReadingsPage />);
    await screen.findByText('Page 1 of 3');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    expect(readingsApi.listReadings).toHaveBeenLastCalledWith({ page: 2, limit: 20 });

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Page 1 of 3');
    expect(readingsApi.listReadings).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  });

  it('disables Next on the last page', async () => {
    const user = userEvent.setup();
    vi.mocked(readingsApi.listReadings).mockImplementation(async ({ page = 1, limit = 20 } = {}) =>
      makePage({ page, limit }),
    );

    render(<ReadingsPage />);
    await screen.findByText('Page 1 of 3');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 3 of 3');

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('disables both controls and shows zero for a user without readings', async () => {
    vi.mocked(readingsApi.listReadings).mockResolvedValue(makePage({ total: 0 }));

    render(<ReadingsPage />);

    expect(await screen.findByText('Showing 0 of 0 readings')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(
      screen.getByText('No readings yet. Add your first reading to start building your history.'),
    ).toBeInTheDocument();
  });

  it('resets to page 1 when the page size changes', async () => {
    const user = userEvent.setup();
    vi.mocked(readingsApi.listReadings).mockImplementation(async ({ page = 1, limit = 20 } = {}) =>
      makePage({ page, limit }),
    );

    render(<ReadingsPage />);
    await screen.findByText('Page 1 of 3');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');

    await user.selectOptions(screen.getByLabelText('Readings per page'), '50');

    await waitFor(() => {
      expect(readingsApi.listReadings).toHaveBeenLastCalledWith({ page: 1, limit: 50 });
    });
    expect(await screen.findByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–45 of 45 readings')).toBeInTheDocument();
  });

  it('shows a loading state while the request is pending', async () => {
    let resolvePage: (value: PaginatedReadings) => void = () => {};
    vi.mocked(readingsApi.listReadings).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );

    const { container } = render(<ReadingsPage />);

    expect(container.querySelector('.animate-spin')).not.toBeNull();

    resolvePage(makePage({ total: 2 }));
    expect(await screen.findByText('Showing 1–2 of 2 readings')).toBeInTheDocument();
  });

  it('shows an error state and retries', async () => {
    const user = userEvent.setup();
    vi.mocked(readingsApi.listReadings)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(makePage({ total: 2, limit: 20 }));

    render(<ReadingsPage />);

    expect(await screen.findByText("We couldn't load your readings.")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Showing 1–2 of 2 readings')).toBeInTheDocument();
    expect(readingsApi.listReadings).toHaveBeenCalledTimes(2);
  });

  it('refreshes after a delete and falls back from an empty last page', async () => {
    const user = userEvent.setup();
    let call = 0;

    vi.mocked(readingsApi.listReadings).mockImplementation(async ({ limit = 20 } = {}) => {
      call += 1;

      if (call === 1) return makePage({ page: 1, limit, total: 21 });
      if (call === 2) return makePage({ page: 2, limit, total: 21 });
      // After the delete, page 2 no longer exists.
      if (call === 3) return makePage({ page: 2, limit, total: 20, data: [] });
      return makePage({ page: 1, limit, total: 20 });
    });
    vi.mocked(readingsApi.deleteReading).mockResolvedValue({
      status: 'ok',
      message: 'Reading deleted successfully.',
    });

    render(<ReadingsPage />);
    await screen.findByText('Page 1 of 2');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');

    await user.click(screen.getByRole('button', { name: /^Delete .* reading on/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–20 of 20 readings')).toBeInTheDocument();
    expect(readingsApi.deleteReading).toHaveBeenCalledTimes(1);
    expect(readingsApi.listReadings).toHaveBeenCalledTimes(4);
  });

  it('keeps the date filter when moving between pages and resets on change', async () => {
    const user = userEvent.setup();
    vi.mocked(readingsApi.listReadings).mockImplementation(async ({ page = 1, limit = 20 } = {}) =>
      makePage({ page, limit }),
    );

    render(<ReadingsPage />);
    await screen.findByText('Page 1 of 3');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    expect(readingsApi.listReadings).toHaveBeenLastCalledWith({ page: 2, limit: 20 });

    const dateInput = screen.getByLabelText('Filter by date');
    fireEvent.change(dateInput, { target: { value: '2026-01-15' } });

    await waitFor(() => {
      expect(readingsApi.listReadings).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        date: '15-01-2026',
      });
    });
  });
});
