'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { fazerLogout } from '@/app/login/actions';
import {
  IconeVisaoGeral,
  IconePonto,
  IconeMapaPin,
  IconeMapa,
  IconeAtividade,
  IconePredio,
  IconeConfig,
  IconeSair,
} from '@/components/ui/icones';

const ABAS = [
  { href: '/', label: 'Visão Geral', Icone: IconeVisaoGeral },
  { href: '/ponto', label: 'Ponto & Banco de Horas', Icone: IconePonto },
  { href: '/mapa-dispositivos', label: 'Mapa de Dispositivos', Icone: IconeMapaPin },
  { href: '/mapa-ponto', label: 'Mapa do Ponto', Icone: IconeMapa },
  { href: '/uso-digital', label: 'Uso Digital', Icone: IconeAtividade },
  { href: '/cadastros/unidades', label: 'Cadastros', Icone: IconePredio },
  { href: '/configuracoes', label: 'Configurações', Icone: IconeConfig },
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'AD';
}

export function Sidebar({ nomeUsuario, nomeEmpresa }: { nomeUsuario: string; nomeEmpresa: string }) {
  const pathname = usePathname();

  function ehAtiva(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-outline-variant bg-surface lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-bold text-on-primary">A</div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-on-surface">Argus</p>
          <p className="truncate text-xs leading-tight text-on-surface-variant">{nomeEmpresa}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {ABAS.map(({ href, label, Icone }) => {
          const ativa = ehAtiva(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors',
                ativa ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              )}
            >
              <Icone strokeWidth={ativa ? 2 : 1.75} className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-outline-variant p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface">
            {iniciais(nomeUsuario)}
          </div>
          <p className="truncate text-sm font-medium text-on-surface">{nomeUsuario}</p>
        </div>
        <form action={fazerLogout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <IconeSair />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
