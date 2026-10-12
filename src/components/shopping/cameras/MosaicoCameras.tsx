'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconeBusca, IconePessoas, IconeSeta } from '@/components/ui/icones';
import { cn } from '@/lib/cn';
import { useMosaicoAoVivo } from './useMosaicoAoVivo';
import { DESTAQUES_MAX, camerasEmDestaque, localDaCamera, nomeAndar, partesDoNome, pessoasNaImagem, type CameraMotor } from './tipos';

export type Layout = 2 | 3 | 4;
export type Ordem = 'numero' | 'movimento';
export type FiltrosMosaico = { busca: string; andar: string; ordem: Ordem; layout: Layout; pagina: number };

const LAYOUTS: Layout[] = [2, 3, 4];
// Fora da tela cheia a grade se adapta à largura: no celular nunca passa de 2 colunas.
const COLUNAS: Record<Layout, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
};

function normalizar(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Câmeras depois de busca, filtro de piso e ordenação (mesma lista que o modo foco percorre). */
export function filtrarCameras(cameras: CameraMotor[], f: Pick<FiltrosMosaico, 'busca' | 'andar' | 'ordem'>): CameraMotor[] {
  const termo = normalizar(f.busca.trim());
  const lista = cameras.filter(
    (c) => (f.andar === 'todos' || c.andar === f.andar) && (!termo || normalizar(`${c.nome} ${localDaCamera(c)}`).includes(termo))
  );
  if (f.ordem === 'movimento') return [...lista].sort((a, b) => Number(b.online) - Number(a.online) || pessoasNaImagem(b) - pessoasNaImagem(a));
  return lista;
}

function IconeGrade({ n }: { n: Layout }) {
  const passo = 16 / n;
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      {Array.from({ length: n * n }, (_, i) => (
        <rect key={i} x={(i % n) * passo + 0.75} y={Math.floor(i / n) * passo + 0.75} width={passo - 1.5} height={passo - 1.5} rx={0.6} fill="currentColor" />
      ))}
    </svg>
  );
}

function IconeTelaCheia({ sair }: { sair: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      {sair ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

export function MosaicoCameras({
  cameras,
  urlMotor,
  filtros,
  setFiltros,
  onAbrir,
}: {
  cameras: CameraMotor[];
  urlMotor: string;
  filtros: FiltrosMosaico;
  setFiltros: (f: Partial<FiltrosMosaico>) => void;
  onAbrir: (id: string) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);

  const andares = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const c of cameras) if (c.andar) contagem.set(c.andar, (contagem.get(c.andar) ?? 0) + 1);
    return [...contagem.entries()];
  }, [cameras]);

  const filtradas = filtrarCameras(cameras, filtros);
  const destaques = camerasEmDestaque(cameras);
  const porPagina = filtros.layout * filtros.layout;
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const pagina = Math.min(filtros.pagina, totalPaginas - 1);
  const visiveis = filtradas.slice(pagina * porPagina, (pagina + 1) * porPagina);

  // Miniaturas maiores quando há menos câmeras por tela.
  const largura = filtros.layout === 2 ? 640 : filtros.layout === 3 ? 480 : 360;
  const registrar = useMosaicoAoVivo(
    urlMotor,
    visiveis.map((c) => c.id),
    largura,
    filtros.layout === 4 ? 3 : 4
  );

  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement === areaRef.current);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else areaRef.current?.requestFullscreen();
  }

  // Atalhos: ← → muda de página, 1-9 abre a câmera da posição, F tela cheia.
  const atalhos = useRef({ pagina, totalPaginas, visiveis, onAbrir, setFiltros, alternarTelaCheia });
  atalhos.current = { pagina, totalPaginas, visiveis, onAbrir, setFiltros, alternarTelaCheia };
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || alvo.closest('input, textarea, select')) return;
      const a = atalhos.current;
      if (e.key === 'ArrowRight' && a.pagina < a.totalPaginas - 1) a.setFiltros({ pagina: a.pagina + 1 });
      else if (e.key === 'ArrowLeft' && a.pagina > 0) a.setFiltros({ pagina: a.pagina - 1 });
      else if (/^[1-9]$/.test(e.key) && a.visiveis[Number(e.key) - 1]) a.onAbrir(a.visiveis[Number(e.key) - 1].id);
      else if (e.key === 'f' || e.key === 'F') a.alternarTelaCheia();
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const paginacao = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setFiltros({ pagina: pagina - 1 })}
        disabled={pagina === 0}
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-outline-variant bg-surface text-on-surface disabled:opacity-40"
        aria-label="Página anterior"
      >
        <IconeSeta className="rotate-180" width={16} height={16} />
      </button>
      <span className="min-w-28 text-center text-xs tabular-nums text-on-surface-variant">
        {filtradas.length === 0
          ? 'Nenhuma câmera'
          : `${pagina * porPagina + 1}–${Math.min(filtradas.length, (pagina + 1) * porPagina)} de ${filtradas.length}`}
      </span>
      <button
        type="button"
        onClick={() => setFiltros({ pagina: pagina + 1 })}
        disabled={pagina >= totalPaginas - 1}
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-outline-variant bg-surface text-on-surface disabled:opacity-40"
        aria-label="Próxima página"
      >
        <IconeSeta width={16} height={16} />
      </button>
    </div>
  );

  return (
    <div ref={areaRef} className={cn('flex flex-col gap-3', telaCheia && 'h-screen bg-black p-3')}>
      {/* Barra de ferramentas */}
      <div className={cn('flex flex-wrap items-center gap-2', telaCheia && 'text-white [&_button]:border-white/20 [&_button]:bg-white/5 [&_button]:text-white')}>
        {!telaCheia && (
          <label className="relative flex h-8 min-w-52 flex-1 items-center sm:max-w-72">
            <IconeBusca className="pointer-events-none absolute left-2.5 text-on-surface-variant" width={15} height={15} />
            <input
              type="search"
              value={filtros.busca}
              onChange={(e) => setFiltros({ busca: e.target.value, pagina: 0 })}
              placeholder="Buscar câmera, piso ou corredor"
              aria-label="Buscar câmera"
              className="h-8 w-full rounded-sm border border-outline-variant bg-surface pl-8 pr-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
            />
          </label>
        )}

        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por piso">
          {[['todos', cameras.length] as const, ...andares].map(([id, qtd]) => {
            const ativo = filtros.andar === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFiltros({ andar: id, pagina: 0 })}
                aria-pressed={ativo}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                  ativo ? '!border-primary !bg-primary !text-on-primary' : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                )}
              >
                {id === 'todos' ? 'Todos os pisos' : nomeAndar(id)} <span className="font-normal opacity-75">{qtd}</span>
              </button>
            );
          })}
        </div>

        <select
          value={filtros.ordem}
          onChange={(e) => setFiltros({ ordem: e.target.value as Ordem, pagina: 0 })}
          aria-label="Ordenar câmeras"
          className={cn('h-8 rounded-sm border px-2 text-xs', telaCheia ? 'border-white/20 bg-black text-white' : 'border-outline-variant bg-surface text-on-surface')}
        >
          <option value="numero">Ordem das câmeras</option>
          <option value="movimento">Mais movimento primeiro</option>
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {paginacao}
          <div className="flex overflow-hidden rounded-sm border border-outline-variant" role="group" aria-label="Câmeras por tela">
            {LAYOUTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFiltros({ layout: n, pagina: 0 })}
                aria-pressed={filtros.layout === n}
                title={`${n * n} câmeras por tela`}
                className={cn(
                  'flex h-8 w-9 items-center justify-center !rounded-none !border-0 transition-colors',
                  filtros.layout === n ? '!bg-primary !text-on-primary' : 'bg-surface text-on-surface-variant hover:bg-surface-container-low'
                )}
              >
                <IconeGrade n={n} />
                <span className="sr-only">{n * n} câmeras por tela</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={alternarTelaCheia}
            title={telaCheia ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
            className="flex h-8 items-center gap-1.5 rounded-sm border border-outline-variant bg-surface px-2.5 text-xs font-medium text-on-surface hover:bg-surface-container-low"
          >
            <IconeTelaCheia sair={telaCheia} />
            {telaCheia ? 'Sair' : 'Tela cheia'}
          </button>
        </div>
      </div>

      {/* Grade de câmeras */}
      {visiveis.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded border border-dashed border-outline-variant text-sm text-on-surface-variant">
          Nenhuma câmera com esses filtros.
          <button type="button" onClick={() => setFiltros({ busca: '', andar: 'todos', pagina: 0 })} className="font-medium text-primary hover:underline">
            Limpar filtros
          </button>
        </div>
      ) : (
        <div
          className={cn('grid gap-2', telaCheia ? 'min-h-0 flex-1 gap-1' : COLUNAS[filtros.layout])}
          style={
            telaCheia
              ? { gridTemplateColumns: `repeat(${filtros.layout}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${filtros.layout}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {visiveis.map((c, i) => {
            const { codigo, titulo } = partesDoNome(c.nome);
            const pessoas = pessoasNaImagem(c);
            const alto = destaques.has(c.id);
            const compacto = filtros.layout === 4;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onAbrir(c.id)}
                title={`Abrir ${c.nome}${i < 9 ? ` (tecla ${i + 1})` : ''}`}
                className={cn(
                  'group relative overflow-hidden bg-neutral-900 text-left outline-none ring-offset-2 ring-offset-surface-dim focus-visible:ring-2 focus-visible:ring-primary',
                  telaCheia ? 'h-full rounded-sm' : 'cartao-clicavel aspect-video rounded-lg',
                  alto && 'ring-2 ring-[var(--color-warning)] ring-offset-0'
                )}
              >
                {c.online ? (
                  <img ref={registrar(c.id)} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/60">
                    <span className="text-sm font-semibold">Sem sinal</span>
                    {!compacto && <span className="max-w-[80%] truncate text-[11px]">{c.erro ?? 'Câmera offline'}</span>}
                  </div>
                )}

                {/* Topo: código + nome */}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent px-2.5 pb-6 pt-2">
                  <div className="min-w-0 text-white">
                    <p className={cn('truncate font-semibold leading-tight', compacto ? 'text-[11px]' : 'text-xs')}>
                      {codigo && <span className="mr-1.5 rounded-[3px] bg-white/20 px-1 py-px font-mono text-[10px]">{codigo.replace(/\s+/, ' ')}</span>}
                      {titulo}
                    </p>
                    {!compacto && <p className="truncate text-[11px] text-white/70">{localDaCamera(c)}</p>}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    <span className={cn('h-1.5 w-1.5 rounded-full', c.online ? 'animate-pulse bg-red-500' : 'bg-white/40')} />
                    {c.online ? 'Ao vivo' : 'Off'}
                  </span>
                </div>

                {/* Rodapé: pessoas */}
                {c.online && (
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
                    {alto ? (
                      <span className="rounded-full bg-[var(--color-warning)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">Mais movimento</span>
                    ) : (
                      <span />
                    )}
                    <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                      <IconePessoas width={13} height={13} />
                      {pessoas}
                    </span>
                  </div>
                )}

                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-900">Abrir câmera</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className={cn('text-[11px] text-on-surface-variant', telaCheia && 'text-white/50')}>
        Clique numa câmera para ver em detalhe. Atalhos: <kbd className="font-mono">1</kbd>–<kbd className="font-mono">9</kbd> abre a câmera da
        posição · <kbd className="font-mono">←</kbd> <kbd className="font-mono">→</kbd> troca de página · <kbd className="font-mono">F</kbd> tela
        cheia. Borda amarela: as {DESTAQUES_MAX} câmeras com mais pessoas agora.
      </p>
    </div>
  );
}
