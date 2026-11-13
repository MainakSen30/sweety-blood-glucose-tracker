import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { deleteReading } from '../../services/readingsApi.js';
import type { Reading, ReadingSlot } from '../../types/reading.js';
import { ReadingFormDialog } from './ReadingFormDialog.js';
import { DeleteReadingDialog } from './DeleteReadingDialog.js';

/**
 * Shared add/edit/delete dialog state so the dashboard and the readings page
 * behave identically. `refresh` runs after any successful mutation. The
 * dialogs are mounted conditionally inside <AnimatePresence>, so each opening
 * starts from a fresh form.
 */
export function useReadingDialogs(refresh: () => void) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reading | undefined>(undefined);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  const [initialSlot, setInitialSlot] = useState<ReadingSlot | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Reading | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = useCallback((date?: string, slot?: ReadingSlot) => {
    setEditing(undefined);
    setInitialDate(date);
    setInitialSlot(slot);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((reading: Reading) => {
    setEditing(reading);
    setInitialDate(undefined);
    setInitialSlot(undefined);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => setFormOpen(false), []);

  const confirmDelete = useCallback(
    async (reading: Reading) => {
      setDeleting(true);

      try {
        await deleteReading(reading.id);
        setDeleteTarget(null);
        refresh();
        return true;
      } finally {
        setDeleting(false);
      }
    },
    [refresh],
  );

  const formDialog = formOpen ? (
    <ReadingFormDialog
      onClose={closeForm}
      onSaved={refresh}
      reading={editing}
      initialDate={initialDate}
      initialSlot={initialSlot}
    />
  ) : null;

  const deleteDialog = deleteTarget ? (
    <DeleteReadingDialog
      reading={deleteTarget}
      onClose={() => setDeleteTarget(null)}
      onConfirm={(reading) => void confirmDelete(reading)}
      deleting={deleting}
    />
  ) : null;

  return {
    openAdd,
    openEdit,
    openDelete: setDeleteTarget,
    dialogs: (
      <AnimatePresence>
        {formDialog}
        {deleteDialog}
      </AnimatePresence>
    ),
  };
}
