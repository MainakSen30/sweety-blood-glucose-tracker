import { type ReactNode } from 'react';
import { BrandMark } from '../ui/icons.js';

/** Shared split layout for the login and registration screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <span className="text-xl font-semibold tracking-tight text-olive-dark">Sweety</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">{subtitle}</p>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">{children}</div>

        <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>
      </div>
    </div>
  );
}
