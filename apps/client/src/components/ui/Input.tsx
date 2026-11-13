import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (fieldProps: { id: string; describedBy: string; invalid: boolean }) => ReactNode;
}

/**
 * Accessible field wrapper: label, hint, and error are wired to the input via
 * aria-describedby / aria-invalid. Children receive the ids to attach.
 */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-terracotta-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'aria-describedby' | 'aria-invalid'
> {
  fieldProps: { id: string; describedBy: string; invalid: boolean };
}

export function Input({ fieldProps, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      id={fieldProps.id}
      aria-describedby={fieldProps.describedBy || undefined}
      aria-invalid={fieldProps.invalid || undefined}
      className={`w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft transition-colors duration-150 ${
        fieldProps.invalid ? 'border-terracotta' : 'border-line hover:border-olive/40'
      } focus:border-olive focus:outline-none focus:ring-2 focus:ring-olive/25`}
    />
  );
}
