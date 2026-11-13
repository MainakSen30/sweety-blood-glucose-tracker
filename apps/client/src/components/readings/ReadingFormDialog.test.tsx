import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadingFormDialog } from './ReadingFormDialog';
import * as readingsApi from '../../services/readingsApi';

vi.mock('../../services/readingsApi', () => ({
  createReading: vi.fn(),
  updateReading: vi.fn(),
}));

afterEach(cleanup);

function renderDialog() {
  return render(<ReadingFormDialog onClose={() => {}} onSaved={() => {}} />);
}

describe('ReadingFormDialog', () => {
  it('shows client-side validation errors when the form is emptied', async () => {
    const user = userEvent.setup();
    renderDialog();

    // The date pre-fills with today; clear it to test the empty case.
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Add reading' }));

    expect(await screen.findByText('Please choose a date.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a glucose value.')).toBeInTheDocument();
    expect(readingsApi.createReading).not.toHaveBeenCalled();
  });

  it('surfaces server-side duplicate-slot conflicts as a form error', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../../services/http');
    vi.mocked(readingsApi.createReading).mockRejectedValue(
      new ApiError(409, 'You already have a Morning (fasting) reading for this date.'),
    );

    renderDialog();

    // Date inputs ignore typed text in jsdom; set their values directly.
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-01-15' } });
    fireEvent.change(screen.getByLabelText('Glucose value'), { target: { value: '105' } });
    await user.click(screen.getByRole('button', { name: 'Add reading' }));

    expect(
      await screen.findByText('You already have a Morning (fasting) reading for this date.'),
    ).toBeInTheDocument();
  });
});
