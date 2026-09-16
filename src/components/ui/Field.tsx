import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const CAMPO_CLASSES =
  'w-full rounded-sm border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

export function Field({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <input className={CAMPO_CLASSES} {...props} />
      {hint && <span className="mt-1 block text-xs text-on-surface-variant">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: { label: string; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <select className={CAMPO_CLASSES} {...props}>
        {children}
      </select>
      {hint && <span className="mt-1 block text-xs text-on-surface-variant">{hint}</span>}
    </label>
  );
}
