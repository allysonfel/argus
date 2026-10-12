'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { caixaEm, fmtTempo, pe, type AreaCaso, type Caso, type PessoaCaso } from '@/lib/shopping/casos';
import { corDoId } from '@/components/shopping/cameras/CameraFoco';

export type Desenho = (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void;
export type Marca = { t: number; rotulo: string; tom?: string };

type Props = {
  urlMotor: string;
  caso: Caso;
  desenhar?: Desenho;
  /** Muda `k` para pular o vídeo para `t` (e tocar). */
  irPara?: { t: number; k: number } | null;
  onTempo?: (t: number) => void;
  marcas?: Marca[];
  /** Vídeos que andam junto (ex.: outra câmera da mesma cena). */
  sincronizar?: React.RefObject<HTMLVideoElement | null>[];
  rodape?: ReactNode;
  autoPlay?: boolean;
};

/** Vídeo real + canvas por cima, desenhado no tempo do vídeo. */
export function PlayerCaso({ urlMotor, caso, desenhar, irPara, onTempo, marcas = [], sincronizar = [], rodape, autoPlay = true }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenharRef = useRef(desenhar);
  const onTempoRef = useRef(onTempo);
  desenharRef.current = desenhar;
  onTempoRef.current = onTempo;
  const [tocando, setTocando] = useState(autoPlay);
  const [vel, setVel] = useState(1);
  const [t, setT] = useState(0);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let raf = 0;
    let ultimoAviso = -1;
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
          desenharRef.current?.(ctx, v.currentTime, w, h);
        }
        // Estado do React só ~5x/s (o desenho é a 60 fps direto no canvas).
        if (Math.abs(v.currentTime - ultimoAviso) > 0.2) {
          ultimoAviso = v.currentTime;
          setT(v.currentTime);
          onTempoRef.current?.(v.currentTime);
        }
        for (const s of sincronizar) {
          const o = s.current;
          if (o && Math.abs(o.currentTime - v.currentTime) > 0.3) o.currentTime = v.currentTime;
          if (o && o.paused !== v.paused) void (v.paused ? o.pause() : o.play().catch(() => {}));
          if (o) o.playbackRate = v.playbackRate;
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [sincronizar]);

  useEffect(() => {
    const v = video.current;
    if (!v || !irPara) return;
    v.currentTime = irPara.t;
    void v.play().catch(() => {});
    setTocando(true);
  }, [irPara]);

  function alternar() {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
      setTocando(true);
    } else {
      v.pause();
      setTocando(false);
    }
  }

  function mudarVel() {
    const proxima = vel === 1 ? 2 : vel === 2 ? 4 : 1;
    setVel(proxima);
    if (video.current) video.current.playbackRate = proxima;
  }

  return (
    <div>
      {/* Vídeo 4:3 (CCTV) ficaria alto demais: limita a ~65% da altura da tela. */}
      <div className="relative mx-auto overflow-hidden rounded-sm bg-black" style={{ aspectRatio: `${caso.largura} / ${caso.altura}`, maxWidth: `calc(65vh * ${caso.largura / caso.altura})` }}>
        <video
          ref={video}
          src={`${urlMotor}/casos/${caso.video}`}
          className="absolute inset-0 h-full w-full"
          muted
          playsInline
          loop
          autoPlay={autoPlay}
          crossOrigin="anonymous"
          onError={() => setErro(true)}
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
        />
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        {erro && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white">
            Não foi possível carregar o vídeo do motor de visão ({urlMotor}). Confira se o motor está no ar.
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button onClick={alternar} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary" aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          )}
        </button>
        <div className="relative h-8 flex-1">
          <input
            type="range"
            min={0}
            max={caso.duracao_s}
            step={0.1}
            value={t}
            onChange={(e) => {
              if (video.current) video.current.currentTime = Number(e.target.value);
            }}
            className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
            aria-label="Posição no vídeo"
          />
          {marcas.map((m, i) => (
            <button
              key={i}
              title={`${fmtTempo(m.t)} · ${m.rotulo}`}
              onClick={() => {
                if (video.current) video.current.currentTime = Math.max(0, m.t - 1);
              }}
              className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-surface"
              style={{ left: `${(m.t / caso.duracao_s) * 100}%`, background: m.tom ?? 'var(--color-primary)' }}
            />
          ))}
        </div>
        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-on-surface-variant">
          {fmtTempo(t)} / {fmtTempo(caso.duracao_s)}
        </span>
        <button onClick={mudarVel} className="h-7 shrink-0 rounded-sm border border-outline-variant px-2 text-xs font-semibold text-on-surface" title="Velocidade">
          {vel}×
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
        <span>
          {caso.nome}
          {caso.credito ? ` · ${caso.credito}` : ''}
        </span>
        {rodape}
      </div>
    </div>
  );
}

// ---------- desenhos reutilizáveis ----------

export function desenharArea(ctx: CanvasRenderingContext2D, a: AreaCaso, w: number, h: number, opts: { rotulo?: boolean; alfa?: number; destaque?: boolean } = {}) {
  ctx.beginPath();
  a.poligono.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.closePath();
  ctx.fillStyle = hexAlfa(a.cor, opts.alfa ?? 0.14);
  ctx.fill();
  ctx.lineWidth = opts.destaque ? 3 : 1.5;
  ctx.setLineDash(opts.destaque ? [] : [6, 4]);
  ctx.strokeStyle = a.cor;
  ctx.stroke();
  ctx.setLineDash([]);
  if (opts.rotulo !== false) {
    const [x, y] = a.poligono[0];
    rotulo(ctx, a.nome, x * w + 6, y * h + 6, a.cor);
  }
}

export function rotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, fundo: string) {
  ctx.font = '600 11px system-ui, sans-serif';
  const larg = ctx.measureText(texto).width + 10;
  // Sempre dentro da imagem (áreas de borda começam fora dela).
  const lw = ctx.canvas.clientWidth || Infinity;
  const lh = ctx.canvas.clientHeight || Infinity;
  x = Math.max(2, Math.min(x, lw - larg - 2));
  y = Math.max(2, Math.min(y, lh - 20));
  ctx.fillStyle = fundo;
  ctx.beginPath();
  ctx.roundRect(x, y, larg, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(texto, x + 5, y + 13);
}

/** Caixas das pessoas presentes no instante t, com rastro dos últimos segundos. */
export function desenharPessoas(
  ctx: CanvasRenderingContext2D,
  pessoas: PessoaCaso[],
  t: number,
  w: number,
  h: number,
  opts: { destaque?: Set<number> | null; rastroS?: number; rotular?: (p: PessoaCaso) => string | null; esmaecer?: boolean } = {},
) {
  for (const p of pessoas) {
    const cx = caixaEm(p, t);
    if (!cx) continue;
    const destacada = opts.destaque?.has(p.id);
    if (opts.destaque && !destacada && opts.esmaecer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx[0] * w, cx[1] * h, (cx[2] - cx[0]) * w, (cx[3] - cx[1]) * h);
      continue;
    }
    const cor = corDoId(p.id);
    if (opts.rastroS) {
      ctx.beginPath();
      let primeiro = true;
      for (const pt of p.pontos) {
        if (pt[0] > t || pt[0] < t - opts.rastroS) continue;
        const [x, y] = pe(pt);
        if (primeiro) ctx.moveTo(x * w, y * h);
        else ctx.lineTo(x * w, y * h);
        primeiro = false;
      }
      ctx.strokeStyle = corDoId(p.id, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.strokeStyle = cor;
    ctx.lineWidth = destacada ? 3.5 : 2;
    ctx.strokeRect(cx[0] * w, cx[1] * h, (cx[2] - cx[0]) * w, (cx[3] - cx[1]) * h);
    const texto = opts.rotular ? opts.rotular(p) : `#${p.id}`;
    if (texto) rotulo(ctx, texto, cx[0] * w, Math.max(0, cx[1] * h - 19), cor);
  }
}

export function hexAlfa(hex: string, alfa: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
