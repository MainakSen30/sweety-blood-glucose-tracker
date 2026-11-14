import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingFormDialog } from './ReadingFormDialog';
import * as readingsApi from '../../services/readingsApi';
import { ApiError } from '../../services/http';
import type { Reading, ReadingSlot } from '../../types/reading';

vi.mock('../../services/readingsApi', () => ({
  createReading: vi.fn(),
  updateReading: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

type FormProps = Parameters<typeof ReadingFormDialog>[0];

function renderForm(props: Partial<FormProps> = {}) {
  return render(<ReadingFormDialog onClose={vi.fn()} onSaved={vi.fn()} {...props} />);
}

function makeReading(overrides: Partial<Reading> = {}): Reading {
  return {
    id: 'reading-1',
    userId: 'user-1',
    readingDate: '01-02-2026',
    slot: 'after_lunch',
    value: 112,
    createdAt: '2026-02-01T10:30:00.000Z',
    updatedAt: '2026-02-01T10:30:00.000Z',
    ...overrides,
  };
}

/**
 * Today in Asia/Kolkata, computed independently of the implementation (the
 * en-CA locale formats as YYYY-MM-DD), so the expectation holds on a machine
 * in any timezone and cannot silently track implementation changes.
 */
function todayInputValueInKolkata(): string {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-');

  return `${year}-${month}-${day}`;
}

/** Fills a valid create-form state; date inputs ignore typed text in jsdom. */
async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  {
    date = '2026-01-15',
    slot,
    value = '105',
  }: { date?: string; slot?: ReadingSlot; value?: string } = {},
) {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: date } });
  if (slot) {
    await user.selectOptions(screen.getByLabelText('Reading slot'), slot);
  }
  fireEvent.change(screen.getByLabelText('Glucose value'), { target: { value } });
}

describe('ReadingFormDialog', () => {
  describe('rendering', () => {
    it('renders every control with an accessible name and the range hint', () => {
      renderForm();

      expect(screen.getByRole('dialog', { name: 'Add reading' })).toBeInTheDocument();
      expect(screen.getByLabelText('Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Reading slot')).toBeInTheDocument();
      expect(screen.getByLabelText('Glucose value')).toBeInTheDocument();
      expect(screen.getByText('Whole number between 40 and 600 mg/dL.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add reading' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('defaults to today in Asia/Kolkata, the morning slot, and an empty value', () => {
      renderForm();

      expect(screen.getByLabelText('Date')).toHaveValue(todayInputValueInKolkata());
      expect(screen.getByLabelText('Reading slot')).toHaveValue('morning');
      expect(screen.getByLabelText('Glucose value')).toHaveDisplayValue('');
    });

    it('offers all four reading slots in chronological order', () => {
      renderForm();

      const labels = [...screen.getByLabelText('Reading slot').querySelectorAll('option')].map(
        (option) => option.textContent,
      );
      expect(labels).toEqual([
        'Morning (fasting)',
        'After breakfast',
        'After lunch',
        'After dinner',
      ]);
    });

    it('populates existing values in edit mode', () => {
      renderForm({
        reading: makeReading({ readingDate: '01-02-2026', slot: 'after_lunch', value: 112 }),
      });

      expect(screen.getByRole('dialog', { name: 'Edit reading' })).toBeInTheDocument();
      expect(screen.getByLabelText('Date')).toHaveValue('2026-02-01');
      expect(screen.getByLabelText('Reading slot')).toHaveValue('after_lunch');
      expect(screen.getByLabelText('Glucose value')).toHaveValue(112);
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });

    it('prefills the date and slot passed by the dashboard quick-add buttons', () => {
      renderForm({ initialDate: '01-02-2026', initialSlot: 'after_dinner' });

      expect(screen.getByLabelText('Date')).toHaveValue('2026-02-01');
      expect(screen.getByLabelText('Reading slot')).toHaveValue('after_dinner');
    });
  });

  describe('validation', () => {
    it('shows client-side errors when the form is emptied', async () => {
      const user = userEvent.setup();
      renderForm();

      // The date pre-fills with today; clear it to test the empty case.
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(await screen.findByText('Please choose a date.')).toBeInTheDocument();
      expect(screen.getByText('Please enter a glucose value.')).toBeInTheDocument();
      expect(readingsApi.createReading).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric glucose value without submitting', async () => {
      const user = userEvent.setup();
      renderForm();

      // Number inputs ignore non-numeric typing in browsers and in jsdom.
      await user.type(screen.getByLabelText('Glucose value'), 'not-a-number');
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(screen.getByText('Please enter a glucose value.')).toBeInTheDocument();
      expect(readingsApi.createReading).not.toHaveBeenCalled();
    });

    it('surfaces the server range error for a value below 40 as a field error', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(400, 'Validation failed', [
          { path: 'value', message: 'Value must be at least 40 mg/dL.' },
        ]),
      );
      renderForm();

      await fillValidForm(user, { value: '39' });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(readingsApi.createReading).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Value must be at least 40 mg/dL.')).toBeInTheDocument();
    });

    it('surfaces the server range error for a value above 600 as a field error', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(400, 'Validation failed', [
          { path: 'value', message: 'Value must be at most 600 mg/dL.' },
        ]),
      );
      renderForm();

      await fillValidForm(user, { value: '601' });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(readingsApi.createReading).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Value must be at most 600 mg/dL.')).toBeInTheDocument();
    });

    it('surfaces the server future-date rejection as a date field error', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(400, 'Validation failed', [
          { path: 'readingDate', message: 'Readings cannot be recorded for a future date.' },
        ]),
      );
      renderForm();

      // The input's max prevents picking a future date in the picker; the
      // server remains the authority if one is submitted anyway.
      await fillValidForm(user, { date: '2027-01-01' });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(readingsApi.createReading).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByText('Readings cannot be recorded for a future date.'),
      ).toBeInTheDocument();
    });
  });

  describe('boundary values', () => {
    it.each(['40', '600'])(
      'accepts the boundary glucose value %s and submits it as a number',
      async (value) => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onSaved = vi.fn();
        vi.mocked(readingsApi.createReading).mockResolvedValue(
          makeReading({ value: Number(value) }),
        );
        renderForm({ onClose, onSaved });

        await fillValidForm(user, { value });
        await user.click(screen.getByRole('button', { name: 'Add reading' }));

        expect(readingsApi.createReading).toHaveBeenCalledWith({
          readingDate: '15-01-2026',
          slot: 'morning',
          value: Number(value),
        });
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(onSaved).toHaveBeenCalledWith('Reading added.');
      },
    );
  });

  describe('reading slots', () => {
    it('submits the slot the user selected', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockResolvedValue(makeReading());
      renderForm();

      await fillValidForm(user, { slot: 'after_dinner' });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(readingsApi.createReading).toHaveBeenCalledWith(
        expect.objectContaining({ slot: 'after_dinner' }),
      );
    });
  });

  describe('successful submission', () => {
    it('creates a reading with the converted API date and closes the dialog', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSaved = vi.fn();
      vi.mocked(readingsApi.createReading).mockResolvedValue(makeReading());
      renderForm({ onClose, onSaved });

      await fillValidForm(user, { date: '2026-01-15', slot: 'after_dinner', value: '105' });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(readingsApi.createReading).toHaveBeenCalledTimes(1);
      expect(readingsApi.createReading).toHaveBeenCalledWith({
        readingDate: '15-01-2026',
        slot: 'after_dinner',
        value: 105,
      });
      expect(onSaved).toHaveBeenCalledWith('Reading added.');
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(readingsApi.updateReading).not.toHaveBeenCalled();
    });

    it('updates an existing reading, preserving its date unless changed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSaved = vi.fn();
      vi.mocked(readingsApi.updateReading).mockResolvedValue(
        makeReading({ value: 130, slot: 'after_dinner' }),
      );
      renderForm({
        reading: makeReading({
          id: 'reading-1',
          readingDate: '01-02-2026',
          slot: 'after_lunch',
          value: 112,
        }),
        onClose,
        onSaved,
      });

      fireEvent.change(screen.getByLabelText('Glucose value'), { target: { value: '130' } });
      await user.selectOptions(screen.getByLabelText('Reading slot'), 'after_dinner');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(readingsApi.updateReading).toHaveBeenCalledTimes(1);
      expect(readingsApi.updateReading).toHaveBeenCalledWith('reading-1', {
        readingDate: '01-02-2026',
        slot: 'after_dinner',
        value: 130,
      });
      expect(onSaved).toHaveBeenCalledWith('Reading updated.');
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(readingsApi.createReading).not.toHaveBeenCalled();
    });
  });

  describe('api errors', () => {
    it('keeps entered values and re-enables the form after an authentication error', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(401, 'Your session has expired. Please log in again.'),
      );
      renderForm();

      await fillValidForm(user, { value: '100' });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Your session has expired. Please log in again.');
      expect(screen.getByLabelText('Glucose value')).toHaveValue(100);
      expect(screen.getByRole('button', { name: 'Add reading' })).toBeEnabled();
    });

    it('shows the server message for a validation error without field details', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(400, 'Please check the reading and try again.'),
      );
      renderForm();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Please check the reading and try again.',
      );
      expect(screen.getByLabelText('Glucose value')).toHaveValue(105);
    });

    it('shows a readable message on a server error', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(500, 'Database unavailable.'),
      );
      renderForm();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable.');
      expect(screen.getByRole('button', { name: 'Add reading' })).toBeEnabled();
    });

    it('falls back to a generic message when the request fails outright', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(new TypeError('Failed to fetch'));
      renderForm();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });

  describe('loading and interaction states', () => {
    it('disables the submit button while saving and never submits twice', async () => {
      const user = userEvent.setup();
      let resolveCreate: (value: Reading) => void = () => {};
      vi.mocked(readingsApi.createReading).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );
      const onClose = vi.fn();
      renderForm({ onClose });

      await fillValidForm(user);
      const submit = screen.getByRole('button', { name: 'Add reading' });
      await user.click(submit);

      expect(submit).toBeDisabled();
      expect(submit).toHaveAttribute('aria-busy', 'true');

      // A second click cannot fire while the button is disabled.
      await user.click(submit);
      expect(readingsApi.createReading).toHaveBeenCalledTimes(1);

      // On success the parent is told to close; saving is not reset because
      // the dialog unmounts.
      resolveCreate(makeReading());
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(readingsApi.createReading).toHaveBeenCalledTimes(1);
    });

    it('re-enables the form after a failed submission so the user can retry', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(new ApiError(500, 'Down.'));
      renderForm();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Add reading' }));
      await screen.findByRole('alert');

      const submit = screen.getByRole('button', { name: 'Add reading' });
      expect(submit).toBeEnabled();
      expect(submit).not.toHaveAttribute('aria-busy');
    });

    it('closes on Cancel without submitting', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderForm({ onClose });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(readingsApi.createReading).not.toHaveBeenCalled();
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderForm({ onClose });

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps Tab focus inside the dialog', async () => {
      const user = userEvent.setup();
      renderForm();

      const dialog = screen.getByRole('dialog');
      expect(document.activeElement).toBe(dialog);

      await user.tab({ shift: true });

      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('submits when the user presses Enter in a field', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockResolvedValue(makeReading());
      renderForm();

      await fillValidForm(user);
      await user.type(screen.getByLabelText('Glucose value'), '{Enter}');

      await waitFor(() => expect(readingsApi.createReading).toHaveBeenCalledTimes(1));
    });

    it('starts fresh for each reading instead of retaining the previous one', () => {
      const first = renderForm({
        reading: makeReading({
          id: 'reading-1',
          readingDate: '05-05-2026',
          slot: 'morning',
          value: 88,
        }),
      });
      first.unmount();

      renderForm({
        reading: makeReading({
          id: 'reading-2',
          readingDate: '06-06-2026',
          slot: 'after_dinner',
          value: 166,
        }),
      });

      expect(screen.getByLabelText('Glucose value')).toHaveValue(166);
      expect(screen.getByLabelText('Reading slot')).toHaveValue('after_dinner');
      expect(screen.getByLabelText('Date')).toHaveValue('2026-06-06');
    });
  });

  describe('server-side duplicate conflicts', () => {
    it('surfaces duplicate-slot conflicts as a form error', async () => {
      const user = userEvent.setup();
      vi.mocked(readingsApi.createReading).mockRejectedValue(
        new ApiError(409, 'You already have a Morning (fasting) reading for this date.'),
      );

      renderForm();

      await fillValidForm(user);
      await user.click(screen.getByRole('button', { name: 'Add reading' }));

      expect(
        await screen.findByText('You already have a Morning (fasting) reading for this date.'),
      ).toBeInTheDocument();
    });
  });

  describe('field errors are associated with their inputs', () => {
    it('marks the invalid input with aria-invalid and an accessible description', async () => {
      const user = userEvent.setup();
      renderForm();

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
      await user.click(screen.getByRole('button', { name: 'Add reading' }));
      await screen.findByText('Please enter a glucose value.');

      const valueInput = screen.getByLabelText('Glucose value');
      expect(valueInput).toHaveAttribute('aria-invalid', 'true');
      expect(valueInput).toHaveAccessibleDescription('Please enter a glucose value.');
      expect(screen.getByLabelText('Date')).toHaveAccessibleDescription('Please choose a date.');
    });
  });
});
