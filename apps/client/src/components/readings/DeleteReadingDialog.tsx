import type { Reading } from '../../types/reading.js';
import { slotLabel } from '../../lib/slots.js';
import { Button } from '../ui/Button.js';
import { Dialog } from '../ui/Dialog.js';

interface DeleteReadingDialogProps {
  reading: Reading;
  onClose: () => void;
  onConfirm: (reading: Reading) => void;
  deleting: boolean;
}

/** Confirmation step before the destructive delete. */
export function DeleteReadingDialog({
  reading,
  onClose,
  onConfirm,
  deleting,
}: DeleteReadingDialogProps) {
  return (
    <Dialog onClose={onClose} title="Delete reading">
      <p className="text-sm leading-6 text-ink-soft">
        Delete the {slotLabel(reading.slot).toLowerCase()} reading of{' '}
        <strong className="font-semibold text-ink">{reading.value} mg/dL</strong> from{' '}
        {reading.readingDate}? This cannot be undone.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Keep reading
        </Button>
        <Button variant="danger" loading={deleting} onClick={() => onConfirm(reading)}>
          Delete
        </Button>
      </div>
    </Dialog>
  );
}
