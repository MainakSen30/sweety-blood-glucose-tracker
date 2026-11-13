import { useState } from 'react';
import { ApiError } from '../../services/http.js';
import { createReading, updateReading } from '../../services/readingsApi.js';
import type { Reading, ReadingSlot } from '../../types/reading.js';
import { apiDateToInputValue, inputValueToApiDate, todayApiDate } from '../../lib/date.js';
import { SLOT_ORDER, slotLabel } from '../../lib/slots.js';
import { Button } from '../ui/Button.js';
import { Dialog } from '../ui/Dialog.js';
import { Field, Input } from '../ui/Input.js';

interface ReadingFormDialogProps {
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Present when editing an existing reading; absent when creating. */
  reading?: Reading;
  initialDate?: string;
  initialSlot?: ReadingSlot;
}

type FieldErrors = Partial<Record<'readingDate' | 'slot' | 'value', string>>;

const SELECT_CLASSES =
  'w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink transition-colors duration-150 focus:border-olive focus:outline-none focus:ring-2 focus:ring-olive/25';

/**
 * Create/edit form for a glucose reading, backed by the real API contracts.
 * Mounted fresh each time it opens, so state initializes from props.
 */
export function ReadingFormDialog({
  onClose,
  onSaved,
  reading,
  initialDate,
  initialSlot,
}: ReadingFormDialogProps) {
  const todayInput = apiDateToInputValue(todayApiDate());
  const [date, setDate] = useState(() =>
    apiDateToInputValue(reading ? reading.readingDate : (initialDate ?? todayApiDate())),
  );
  const [slot, setSlot] = useState<ReadingSlot>(reading?.slot ?? initialSlot ?? 'morning');
  const [value, setValue] = useState(reading ? String(reading.value) : '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');

    // Immediate client-side validation for the common cases; the server
    // remains the authority for everything else.
    const errors: FieldErrors = {};

    if (!date) {
      errors.readingDate = 'Please choose a date.';
    }
    if (!value.trim()) {
      errors.value = 'Please enter a glucose value.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    const payload = {
      readingDate: inputValueToApiDate(date),
      slot,
      value: Number(value),
    };

    try {
      if (reading) {
        await updateReading(reading.id, payload);
        onSaved('Reading updated.');
      } else {
        await createReading(payload);
        onSaved('Reading added.');
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details && error.details.length > 0) {
          setFieldErrors(
            Object.fromEntries(error.details.map((detail) => [detail.path, detail.message])),
          );
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      setSaving(false);
    }
  }

  return (
    <Dialog onClose={onClose} title={reading ? 'Edit reading' : 'Add reading'}>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
        <Field label="Date" error={fieldErrors.readingDate}>
          {(fieldProps) => (
            <Input
              fieldProps={fieldProps}
              type="date"
              max={todayInput}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </Field>

        <Field label="Reading slot" error={fieldErrors.slot}>
          {(fieldProps) => (
            <select
              id={fieldProps.id}
              aria-describedby={fieldProps.describedBy || undefined}
              aria-invalid={fieldProps.invalid || undefined}
              value={slot}
              onChange={(event) => setSlot(event.target.value as ReadingSlot)}
              className={`${SELECT_CLASSES} ${fieldProps.invalid ? 'border-terracotta' : 'border-line hover:border-olive/40'}`}
            >
              {SLOT_ORDER.map((option) => (
                <option key={option} value={option}>
                  {slotLabel(option)}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label="Glucose value"
          error={fieldErrors.value}
          hint="Whole number between 40 and 600 mg/dL."
        >
          {(fieldProps) => (
            <Input
              fieldProps={fieldProps}
              type="number"
              inputMode="numeric"
              min={40}
              max={600}
              step={1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. 105"
            />
          )}
        </Field>

        {formError ? (
          <p
            role="alert"
            className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta-ink"
          >
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {reading ? 'Save changes' : 'Add reading'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
