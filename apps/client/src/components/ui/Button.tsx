import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-olive-dark text-cream hover:bg-olive disabled:hover:bg-olive-dark',
  secondary: 'border border-line bg-surface text-ink hover:border-olive/40 hover:bg-sage/40',
  ghost: 'text-ink-soft hover:bg-sage/50 hover:text-ink',
  danger: 'bg-terracotta text-cream hover:bg-terracotta-ink',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-sm',
  sm: 'min-h-9 px-3 text-xs',
};

/**
 * The shared button. Hover/press feedback is a plain CSS transition — the
 * cheapest tool for a state toggle — with a 150ms press scale for tactility.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,border-color,color,transform] duration-150 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Shared pending state: the spinner is decorative, the label is announced. */
export function LoadingState({
  label = 'Loading…',
  className = 'py-24',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-label={label} className={`flex justify-center ${className}`}>
      <Spinner className="size-6 text-olive" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
