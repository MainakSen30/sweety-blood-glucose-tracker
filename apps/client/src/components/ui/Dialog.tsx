import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { CloseIcon } from './icons.js';

interface DialogProps {
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal dialog: labelled, Escape to close, focus moved in on open and
 * restored on close. Mount it conditionally inside an <AnimatePresence> so
 * enter/exit run; the parent decides when it exists.
 */
export function Dialog({ onClose, title, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();

  // Keep the latest handler without re-running the mount-only setup below.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    // The portal lives outside #root, so making the app inert contains focus
    // without affecting the dialog itself.
    const appRoot = document.getElementById('root');
    appRoot?.setAttribute('inert', '');
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Belt and braces: if something outside the panel takes focus, bring it back.
    const handleFocusIn = (event: FocusEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        panelRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.body.style.overflow = '';
      appRoot?.removeAttribute('inert');
      const target = restoreFocusRef.current;
      if (target?.isConnected) target.focus();
    };
  }, []);

  const enter = { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const };
  const leave = { duration: 0.15, ease: [0.23, 1, 0.32, 1] as const };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: leave }}
      transition={enter}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-olive-dark/25"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={
          reduceMotion
            ? { opacity: 0, transition: leave }
            : { opacity: 0, y: 12, scale: 0.97, transition: leave }
        }
        transition={enter}
        className="relative w-full max-w-md rounded-2xl bg-surface p-5 shadow-[0_24px_48px_-16px_rgb(52_63_43/0.35)] outline-none sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-sage/50 hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
