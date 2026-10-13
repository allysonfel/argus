'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { fazerLogout } from '@/app/(sistema)/login/actions';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { LogoArgus } from './Logo';
import {
  IconeVisaoGeral,
  IconeCamera,
  IconeCalor,
  IconeZonaMorta,
  IconeComparar,
  IconeRotas,
  IconeCrianca,
  IconeAtividade,
  IconeSair,
} from '@/components/ui/icones';

export const GRUPOS = [
  {
    titulo: 'Operação',
    abas: [
      { href: '/shopping', label: 'Visão geral', Icone: IconeVisaoGeral },
      { href: '/shopping/ao-vivo', label: 'Câmeras ao vivo', Icone: IconeCamera },
    ],
  },
  {
    titulo: 'Fluxo e espaços',
    abas: [
      { href: '/shopping/mapa-calor', label: 'Mapa de calor', Icone: IconeCalor },
      { href: '/shopping/zonas-mortas', label: 'Zonas mortas', Icone: IconeZonaMorta },
      { href: '/shopping/comparativo', label: 'Comparativo de períodos', Icone: IconeComparar },
      { href: '/shopping/rotas', label: 'Rotas e fluxo', Icone: IconeRotas },
    ],
  },
  {
    titulo: 'Segurança',
    abas: [
      { href: '/shopping/crianca-perdida', label: 'Busca de criança perdida', Icone: IconeCrianca },
    ],
  },
  {
    titulo: 'Sistema',
    abas: [
      { href: '/shopping/cameras', label: 'Câmeras e saúde', Icone: IconeAtividade },
    ],
  },
];

function ehAtiva(pathname: string, href: string) {
  return href === '/shopping' ? pathname === '/shopping' : pathname.startsWith(href);
}

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{g.titulo}</p>
          <div className="flex flex-col gap-0.5">
            {g.abas.map(({ href, label, Icone }) => {
              const ativa = ehAtiva(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={aoNavegar}
                  className={cn(
                    'relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                    ativa
                      ? 'bg-primary-container font-semibold text-on-primary-container before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  )}
                >
                  <Icone strokeWidth={ativa ? 2 : 1.75} className="shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Cabecalho() {
  return (
    <div className="px-6 pb-4 pt-6">
      <LogoArgus className="h-3 text-on-surface" />
      <p className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Inteligência Patrimonial</p>
      {/* Logo do cliente: direto no fundo claro; no tema escuro ganha um fundo branco (o texto dele é escuro). */}
      <div className="logo-cliente mt-5 flex justify-center rounded-md py-1">
        <img src="/caruaru-shopping.png" alt="Caruaru Shopping" className="h-[72px] w-auto" />
      </div>
    </div>
  );
}

function Rodape({ nomeUsuario }: { nomeUsuario: string }) {
  return (
    <div className="border-t border-outline-variant p-4">
      <ThemeToggle />
      <p className="mb-2 truncate text-sm font-medium text-on-surface">{nomeUsuario}</p>
      <form action={fazerLogout}>
        <button type="submit" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface">
          <IconeSair />
          Sair
        </button>
      </form>
    </div>
  );
}

export function SidebarShopping({ nomeUsuario }: { nomeUsuario: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-outline-variant bg-surface lg:flex print:hidden">
      <Cabecalho />
      <Navegacao />
      <Rodape nomeUsuario={nomeUsuario} />
    </aside>
  );
}

/** No celular: barra no topo com botão que abre o menu completo. */
export function MenuMovelShopping({ nomeUsuario }: { nomeUsuario: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="lg:hidden print:hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-outline-variant bg-surface/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <LogoArgus className="h-3.5 text-on-surface" />
          <span className="rounded-sm bg-white p-0.5">
            <img src="/caruaru-shopping.png" alt="Caruaru Shopping" className="h-7 w-auto" />
          </span>
        </div>
        <button onClick={() => setAberto(true)} className="rounded-sm border border-outline-variant px-3 py-1.5 text-sm text-on-surface" aria-label="Abrir menu">
          Menu
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-72 flex-col bg-surface">
            <Cabecalho />
            <Navegacao aoNavegar={() => setAberto(false)} />
            <Rodape nomeUsuario={nomeUsuario} />
          </div>
          <button className="flex-1 bg-black/40" aria-label="Fechar menu" onClick={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}
