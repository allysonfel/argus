'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ABAS = [
  { href: '/cadastros/unidades', label: 'Unidades' },
  { href: '/cadastros/departamentos', label: 'Departamentos' },
  { href: '/cadastros/colaboradores', label: 'Colaboradores' },
  { href: '/cadastros/dispositivos', label: 'Dispositivos' },
];

export function CadastrosTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-outline-variant">
      {ABAS.map((a) => {
        const ativa = pathname.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              ativa ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            )}
          >
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
