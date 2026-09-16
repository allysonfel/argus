import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// Botão do ADMIN (ver DESIGN.md, seção "button-admin-*") — rounded-sm
// técnico, nunca pílula (isso é só pro site público, que não existe aqui).
type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-[var(--color-primary-hover)]',
  outline: 'border border-outline-variant text-on-surface bg-surface hover:bg-surface-container-low',
  ghost: 'text-on-surface hover:bg-surface-container-low',
  danger: 'bg-error text-on-error hover:opacity-90',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-sm',
  md: 'h-10 px-4 text-sm rounded-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', size = 'md', fullWidth, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    />
  );
}
