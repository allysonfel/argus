import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'success' | 'error' | 'warning' | 'info';

const VARIANT_CLASSES: Record<Variant, string> = {
  success: 'bg-success-container text-on-success-container border-success/20',
  error: 'bg-error-container text-on-error-container border-error/20',
  warning: 'bg-warning-container text-on-warning-container border-warning/20',
  info: 'bg-surface-container text-on-surface border-outline-variant',
};

export function Alert({ variant = 'info', children, className }: { variant?: Variant; children: ReactNode; className?: string }) {
  return <div className={cn('rounded border px-4 py-3 text-sm font-medium', VARIANT_CLASSES[variant], className)}>{children}</div>;
}
