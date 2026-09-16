import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// Card do admin: borda fina (outline-variant), sem sombra pesada — ver
// DESIGN.md "Elevation & Depth": profundidade vem de borda, não de shadow.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded bg-surface border border-outline-variant p-6', className)} {...props} />;
}
