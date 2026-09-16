import type { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'primary' | 'warning' | 'error';
  className?: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'text-on-surface',
    primary: 'text-primary',
    warning: 'text-[var(--color-on-warning-container)]',
    error: 'text-error',
  };
  return (
    <Card className={cn('flex items-start justify-between gap-3', className)}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">{label}</p>
        <p className={cn('mt-1.5 text-3xl font-semibold tabular-nums', toneClasses[tone])}>{value}</p>
        {hint && <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>}
      </div>
      {icon && <div className="shrink-0 text-on-surface-variant">{icon}</div>}
    </Card>
  );
}
