import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Transient confirmation note (aria-live so screen readers hear it). Used
 * after add/edit/delete actions.
 */
export function StatusNote({ message, onDone }: { message: string; onDone: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  if (!message) {
    return null;
  }

  return (
    <motion.p
      role="status"
      aria-live="polite"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-xl border border-sage bg-sage/40 px-3 py-2 text-sm text-olive-dark"
    >
      {message}
    </motion.p>
  );
}
