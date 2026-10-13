'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PlayerCaso } from '@/components/shopping/casos/PlayerCaso';
import { partesDoNome } from '@/components/shopping/cameras/tipos';
import { POSICAO_NA_PLANTA, type Caso } from '@/lib/shopping/casos';
import type { Andar } from '@/lib/shopping/planta';
import type { CameraReal } from '@/lib/shopping/real';

// Mosaico das câmeras de demonstração com o vídeo REAL tocando e o desenho
// (calor, zonas, caminhos) por cima, no tempo do vídeo. Clicar numa câmera
// abre ela grande, com a barra para arrastar no tempo.

// `onde`: o mosaico e a câmera ampliada tocam em tempos diferentes (estado separado).
export type DesenhoCamera = (cam: CameraReal, ctx: CanvasRenderingContext2D, t: number, w: number, h: number, onde: 'mosaico' | 'ampliada') => void;

export const VELOCIDADES_REAIS = [
  { rotulo: 'Velocidade natural', v: 1 },
  { rotulo: 'Acelerar 2×', v: 2 },
  { rotulo: 'Acelerar 4×', v: 4 },
];

function Tile({ urlMotor, cam, desenhar, tocando, vel, legenda, onAbrir }: { urlMotor: string; cam: CameraReal; desenhar: DesenhoCamera; tocando: boolean; vel: number; legenda: (cam: CameraReal, t: number) => ReactNode; onAbrir: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenharRef = useRef(desenhar);
  desenharRef.current = desenhar;
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf = 0;
    let aviso = -1;
    const passo = () => {
      const v = video.current;
      const c = canvas.current;
      if (v && c) {
        const w = c.clientWidth;
        const h = c.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          desenharRef.current(cam, ctx, v.currentTime, w, h, 'mosaico');
        }
        if (Math.abs(v.currentTime - aviso) > 0.5) {
          aviso = v.currentTime;
          setT(v.currentTime);
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [cam]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = vel;
    if (tocando) void v.play().catch(() => {});
    else v.pause();
  }, [tocando, vel]);

  const { codigo, titulo } = partesDoNome(cam.caso.nome);
  return (
    <button type="button" onClick={onAbrir} className="group overflow-hidden rounded-sm border border-outline-variant bg-surface text-left transition-shadow hover:shadow-md">
      <div className="relative bg-black" style={{ aspectRatio: `${cam.caso.largura} / ${cam.caso.altura}` }}>
        <video ref={video} src={`${urlMotor}/casos/${cam.caso.video}`} muted loop playsInline autoPlay preload="auto" className="absolute inset-0 h-full w-full object-fill" />
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Ampliar</span>
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-semibold text-on-surface">
          {codigo && <span className="mr-1 font-mono text-on-surface-variant">{codigo}</span>}
          {titulo}
        </p>
        <div className="mt-0.5 text-[11px] text-on-surface-variant">{legenda(cam, t)}</div>
      </div>
    </button>
  );
}

type Props = {
  urlMotor: string;
  cameras: CameraReal[];
  desenhar: DesenhoCamera;
  legenda: (cam: CameraReal, t: number) => ReactNode;
  /** Controles extras da tela (ex.: tipo de calor). */
  controles?: ReactNode;
  /** Painel ao lado da câmera ampliada. */
  detalhe?: (cam: CameraReal) => ReactNode;
  /** Câmera ampliada controlada de fora (ex.: clique no mapa). */
  aberta?: string | null;
  onAberta?: (camera: string | null) => void;
};

export function MosaicoReal({ urlMotor, cameras, desenhar, legenda, controles, detalhe, aberta: abertaFora, onAberta }: Props) {
  const [andar, setAndar] = useState<Andar | 'todos'>('T');
  const [tocando, setTocando] = useState(true);
  const [vel, setVel] = useState(1);
  const [abertaInterna, setAbertaInterna] = useState<string | null>(null);
  const aberta = abertaFora !== undefined ? abertaFora : abertaInterna;
  const setAberta = (id: string | null) => (onAberta ? onAberta(id) : setAbertaInterna(id));
  const topo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (abertaFora) topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [abertaFora]);
  const andarDe = (c: Caso) => POSICAO_NA_PLANTA[c.camera]?.andar ?? c.andar;
  const visiveis = cameras.filter((c) => andar === 'todos' || andarDe(c.caso) === andar);
  const cam = cameras.find((c) => c.caso.camera === aberta);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setTocando(!tocando)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary" aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          )}
        </button>
        <select value={vel} onChange={(e) => setVel(Number(e.target.value))} className="h-9 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface" aria-label="Velocidade">
          {VELOCIDADES_REAIS.map((v) => (
            <option key={v.v} value={v.v}>
              {v.rotulo}
            </option>
          ))}
        </select>
        <div className="flex rounded-sm bg-surface-container p-1">
          {([['T', 'Térreo'], ['P1', 'Piso 1'], ['todos', 'Todas']] as const).map(([a, nome]) => (
            <button key={a} onClick={() => setAndar(a)} className={`h-8 rounded-sm px-3 text-sm font-medium ${andar === a ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {nome}
            </button>
          ))}
        </div>
        {controles}
      </div>

      {cam && (
        <div ref={topo} className="grid scroll-mt-4 grid-cols-1 gap-4 rounded-sm border border-primary/40 p-3 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <PlayerCaso key={cam.caso.camera} urlMotor={urlMotor} caso={cam.caso} desenhar={(ctx, t, w, h) => desenhar(cam, ctx, t, w, h, 'ampliada')} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-on-surface">{cam.caso.nome}</p>
              <button onClick={() => setAberta(null)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                Fechar
              </button>
            </div>
            {detalhe?.(cam)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((c) => (
          <Tile key={c.caso.camera} urlMotor={urlMotor} cam={c} desenhar={desenhar} tocando={tocando} vel={vel} legenda={legenda} onAbrir={() => setAberta(c.caso.camera)} />
        ))}
      </div>
      <p className="text-xs text-on-surface-variant">
        Vídeos de demonstração (de {Math.round(Math.min(...cameras.map((c) => c.caso.duracao_s)))} s a {Math.round(Math.max(...cameras.map((c) => c.caso.duracao_s)))} s cada, repetindo). Cada número sai do que o motor de visão rastreou neles. Outros dias só ficam disponíveis com as câmeras do shopping ligadas.
      </p>
    </div>
  );
}

/** Carrega as câmeras reais (casos + geometria) uma vez. */
export function useCamerasReais(urlMotor: string, carregar: (u: string) => Promise<CameraReal[]>) {
  const [cameras, setCameras] = useState<CameraReal[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    carregar(urlMotor)
      .then(setCameras)
      .catch((e) => setErro(String(e?.message ?? e)));
  }, [urlMotor, carregar]);
  return { cameras, erro };
}
