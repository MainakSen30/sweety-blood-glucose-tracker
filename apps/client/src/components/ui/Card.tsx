import { type ReactNode } from 'react';

/** Base surface: 1px border on the light surface, 16px radius. */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
