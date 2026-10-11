'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { IconeVisaoGeral, IconeCamera, IconePonto, IconeMapaPin, IconeAtividade, IconeConfig } from '@/components/ui/icones';

// Versão enxuta da nav (5 ícones, sem rótulo) pro rodapé no celular —
// Mapa do Ponto e Cadastros ficam a um toque de distância dentro de
// Configurações/Mapa de Dispositivos, não repetidos aqui por espaço.
const ABAS = [
  { href: '/painel', label: 'Visão Geral', Icone: IconeVisaoGeral },
  { href: '/painel/ao-vivo', label: 'Ao vivo', Icone: IconeCamera },
  { href: '/painel/ponto', label: 'Ponto', Icone: IconePonto },
  { href: '/painel/mapa-dispositivos', label: 'Mapa', Icone: IconeMapaPin },
  { href: '/painel/uso-digital', label: 'Uso Digital', Icone: IconeAtividade },
  { href: '/painel/configuracoes', label: 'Config', Icone: IconeConfig },
];

export function MobileNav() {
  const pathname = usePathname();
  function ehAtiva(href: string) {
    return href === '/painel' ? pathname === '/painel' : pathname.startsWith(href);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <nav className="flex items-center justify-between px-4 py-1.5">
        {ABAS.map(({ href, label, Icone }) => {
          const ativa = ehAtiva(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn('flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-sm', ativa ? 'text-primary' : 'text-on-surface-variant')}
            >
              <Icone strokeWidth={ativa ? 2 : 1.75} width={20} height={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
