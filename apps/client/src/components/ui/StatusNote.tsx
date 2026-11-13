import { useEffect } from 'react';

/**
 * Transient confirmation note (aria-live so screen readers hear it). Used
 * after add/edit/delete actions.
 */
export function StatusNote({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  if (!message) {
    return null;
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-xl border border-sage bg-sage/40 px-3 py-2 text-sm text-olive-dark"
    >
      {message}
    </p>
  );
}
