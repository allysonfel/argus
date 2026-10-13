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
  IconePessoas,
  IconeConfig,
} from '@/components/ui/icones';
import { podeVer, type AbaId, type Permissoes } from '@/lib/shopping/permissoes';

export const GRUPOS: { titulo: string; abas: { href: string; label: string; Icone: typeof IconeVisaoGeral; aba: AbaId }[] }[] = [
  {
    titulo: 'Operação',
    abas: [
      { href: '/shopping', label: 'Visão geral', Icone: IconeVisaoGeral, aba: 'visao-geral' },
      { href: '/shopping/ao-vivo', label: 'Câmeras ao vivo', Icone: IconeCamera, aba: 'cameras' },
    ],
  },
  {
    titulo: 'Fluxo e espaços',
    abas: [
      { href: '/shopping/mapa-calor', label: 'Mapa de calor', Icone: IconeCalor, aba: 'mapa-calor' },
      { href: '/shopping/zonas-mortas', label: 'Zonas mortas', Icone: IconeZonaMorta, aba: 'zonas-mortas' },
      { href: '/shopping/comparativo', label: 'Comparativo de períodos', Icone: IconeComparar, aba: 'comparativo' },
      { href: '/shopping/rotas', label: 'Rotas e fluxo', Icone: IconeRotas, aba: 'rotas' },
    ],
  },
  {
    titulo: 'Segurança',
    abas: [{ href: '/shopping/crianca-perdida', label: 'Busca de criança perdida', Icone: IconeCrianca, aba: 'crianca-perdida' }],
  },
  {
    titulo: 'Sistema',
    abas: [
      { href: '/shopping/cameras', label: 'Câmeras e saúde', Icone: IconeAtividade, aba: 'cameras' },
      { href: '/shopping/usuarios', label: 'Usuários', Icone: IconePessoas, aba: 'usuarios' },
      { href: '/shopping/configuracoes', label: 'Configurações', Icone: IconeConfig, aba: 'configuracoes' },
    ],
  },
];

/** Dados que a sidebar recebe do layout (servidor). */
export type DadosMenu = { nomeUsuario: string; permissoes: Permissoes; nomeShopping: string; logo: string | null };

function ehAtiva(pathname: string, href: string) {
  return href === '/shopping' ? pathname === '/shopping' : pathname.startsWith(href);
}

function Navegacao({ permissoes, aoNavegar }: { permissoes: Permissoes; aoNavegar?: () => void }) {
  const pathname = usePathname();
  // Só as abas que o usuário pode ver (o servidor também bloqueia as rotas).
  const grupos = GRUPOS.map((g) => ({ ...g, abas: g.abas.filter((a) => podeVer(permissoes, a.aba)) })).filter((g) => g.abas.length);
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
      {grupos.map((g) => (
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
      {/* Slogan logo embaixo, nunca mais largo que o logotipo */}
      <div className="inline-flex flex-col items-start">
        <LogoArgus className="h-7 text-on-surface" />
        <span className="mt-1 whitespace-nowrap text-[6.5px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Inteligência Patrimonial</span>
      </div>
    </div>
  );
}

function Rodape({ nomeUsuario, nomeShopping, logo }: DadosMenu) {
  return (
    <div className="border-t border-outline-variant p-4">
      <ThemeToggle />
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
          <img src={logo ?? '/caruaru-simbolo.png'} alt="" className="h-7 w-7 object-contain" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight text-on-surface">{nomeUsuario}</p>
          <p className="truncate text-xs leading-tight text-on-surface-variant">{nomeShopping}</p>
        </div>
      </div>
      <form action={fazerLogout}>
        <button type="submit" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface">
          <IconeSair />
          Sair
        </button>
      </form>
    </div>
  );
}

export function SidebarShopping(dados: DadosMenu) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-outline-variant bg-surface lg:flex print:hidden">
      <Cabecalho />
      <Navegacao permissoes={dados.permissoes} />
      <Rodape {...dados} />
    </aside>
  );
}

/** No celular: barra no topo com botão que abre o menu completo. */
export function MenuMovelShopping(dados: DadosMenu) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="lg:hidden print:hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-outline-variant bg-surface/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <LogoArgus className="h-5 text-on-surface" />
          <img src={dados.logo ?? '/caruaru-simbolo.png'} alt={dados.nomeShopping} className="h-7 w-7 object-contain" />
        </div>
        <button onClick={() => setAberto(true)} className="rounded-sm border border-outline-variant px-3 py-1.5 text-sm text-on-surface" aria-label="Abrir menu">
          Menu
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-72 flex-col bg-surface">
            <Cabecalho />
            <Navegacao permissoes={dados.permissoes} aoNavegar={() => setAberto(false)} />
            <Rodape {...dados} />
          </div>
          <button className="flex-1 bg-black/40" aria-label="Fechar menu" onClick={() => setAberto(false)} />
        </div>
      )}
    </div>
  );
}
