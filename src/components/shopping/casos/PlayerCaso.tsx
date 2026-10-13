'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { caixaEm, fmtTempo, pe, type AreaCaso, type Caso, type PessoaCaso } from '@/lib/shopping/casos';
import { corDoId } from '@/components/shopping/cameras/CameraFoco';
import { baixarBlob, baixarUrl, fmtArquivoTempo, gravarCanvas, nomeArquivo, podeGravar } from '@/lib/shopping/gravacao';

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
  /** Trecho que o botão Baixar grava com as marcações (padrão: o vídeo inteiro). */
  trecho?: { inicio: number; fim: number; rotulo: string };
};

/** Vídeo real + canvas por cima, desenhado no tempo do vídeo. */
export function PlayerCaso({ urlMotor, caso, desenhar, irPara, onTempo, marcas = [], sincronizar = [], rodape, autoPlay = true, trecho }: Props) {
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

  // Tela cheia: a caixa do vídeo (com o desenho por cima) ocupa a tela,
  // mantendo a proporção pra o desenho continuar alinhado.
  const tela = useRef<HTMLDivElement>(null);
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const ouvir = () => setCheia(document.fullscreenElement === tela.current && !!tela.current);
    document.addEventListener('fullscreenchange', ouvir);
    return () => document.removeEventListener('fullscreenchange', ouvir);
  }, []);
  function alternarTelaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void tela.current?.requestFullscreen?.().catch(() => {});
  }

  // ---------- baixar ----------
  const [menuBaixar, setMenuBaixar] = useState(false);
  const [gravando, setGravando] = useState<number | null>(null); // 0-1
  const [erroBaixar, setErroBaixar] = useState<string | null>(null);
  const cancelar = useRef(false);
  const ini = Math.max(0, trecho?.inicio ?? 0);
  const fim = Math.min(caso.duracao_s, trecho?.fim ?? caso.duracao_s);
  const rotuloTrecho = trecho?.rotulo ?? 'video-inteiro';

  /** Toca o trecho num vídeo escondido, desenha quadro + marcações num canvas e grava. */
  async function baixarTrecho() {
    setMenuBaixar(false);
    setErroBaixar(null);
    cancelar.current = false;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.src = `${urlMotor}/casos/${caso.video}`;
    try {
      await new Promise<void>((ok, falha) => {
        v.onloadeddata = () => ok();
        v.onerror = () => falha(new Error('não carregou o vídeo'));
      });
      v.currentTime = ini;
      await new Promise((ok) => (v.onseeked = ok));
      // Vídeo pequeno (CCTV 384x288) é gravado ampliado, pra marcação ficar legível.
      const escala = v.videoWidth < 800 ? 2 : 1;
      const c = document.createElement('canvas');
      c.width = v.videoWidth * escala;
      c.height = v.videoHeight * escala;
      const ctx = c.getContext('2d')!;
      const gravacao = gravarCanvas(c);
      setGravando(0);
      await v.play();
      await new Promise<void>((ok) => {
        const passo = () => {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          desenharRef.current?.(ctx, v.currentTime, c.width, c.height);
          setGravando(Math.min(1, (v.currentTime - ini) / Math.max(0.1, fim - ini)));
          if (cancelar.current || v.currentTime >= fim || v.ended) return ok();
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
      v.pause();
      const blob = await gravacao.parar();
      if (!cancelar.current) baixarBlob(blob, nomeArquivo([caso.nome, rotuloTrecho, fmtArquivoTempo(ini)], gravacao.ext));
    } catch (e) {
      setErroBaixar(`Não foi possível gravar o trecho (${e instanceof Error ? e.message : e}).`);
    } finally {
      v.removeAttribute('src');
      setGravando(null);
    }
  }

  async function baixarOriginal() {
    setMenuBaixar(false);
    setErroBaixar(null);
    try {
      await baixarUrl(`${urlMotor}/casos/${caso.video}`, nomeArquivo([caso.nome, 'original'], 'mp4'));
    } catch (e) {
      setErroBaixar(`Não foi possível baixar o vídeo (${e instanceof Error ? e.message : e}).`);
    }
  }

  function mudarVel() {
    const proxima = vel === 1 ? 2 : vel === 2 ? 4 : 1;
    setVel(proxima);
    if (video.current) video.current.playbackRate = proxima;
  }

  return (
    <div>
      <div ref={tela} className={cheia ? 'flex h-full w-full items-center justify-center bg-black' : ''}>
      {/* Vídeo 4:3 (CCTV) ficaria alto demais: limita a ~65% da altura da tela. */}
      <div
        className="group relative mx-auto overflow-hidden rounded-sm bg-black"
        style={cheia ? { aspectRatio: `${caso.largura} / ${caso.altura}`, width: `min(100vw, calc(100vh * ${caso.largura / caso.altura}))` } : { aspectRatio: `${caso.largura} / ${caso.altura}`, maxWidth: `calc(65vh * ${caso.largura / caso.altura})` }}
      >
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
        <button
          type="button"
          onClick={alternarTelaCheia}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-80 transition-opacity hover:opacity-100 group-hover:opacity-100"
          title={cheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
        >
          <IconeTelaCheia saindo={cheia} />
          {cheia ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
      </div>
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
        <button onClick={alternarTelaCheia} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-outline-variant text-on-surface" title="Tela cheia" aria-label="Tela cheia">
          <IconeTelaCheia saindo={false} />
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuBaixar(!menuBaixar)}
            disabled={gravando !== null}
            className="flex h-7 items-center gap-1 rounded-sm border border-outline-variant px-2 text-xs font-medium text-on-surface disabled:opacity-60"
            title="Baixar vídeo"
          >
            <IconeBaixar />
            {gravando !== null ? `${Math.round(gravando * 100)}%` : 'Baixar'}
          </button>
          {menuBaixar && (
            <div className="absolute bottom-full right-0 z-30 mb-1.5 w-72 rounded-md border border-outline-variant bg-surface p-1 shadow-lg">
              {podeGravar() && (
                <button onClick={baixarTrecho} className="block w-full rounded-sm px-3 py-2 text-left hover:bg-surface-container-low">
                  <span className="block text-sm font-medium text-on-surface">Trecho com as marcações</span>
                  <span className="block text-xs text-on-surface-variant">
                    {fmtTempo(ini)} a {fmtTempo(fim)} · grava em tempo real ({Math.round(fim - ini)} s)
                  </span>
                </button>
              )}
              <button onClick={baixarOriginal} className="block w-full rounded-sm px-3 py-2 text-left hover:bg-surface-container-low">
                <span className="block text-sm font-medium text-on-surface">Vídeo original</span>
                <span className="block text-xs text-on-surface-variant">o arquivo inteiro da câmera, sem marcações (.mp4)</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {gravando !== null && (
        <div className="mt-2 flex items-center gap-3 rounded-sm bg-primary/10 px-3 py-2 text-xs text-on-surface">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
          Gravando o trecho com as marcações… {Math.round(gravando * 100)}%
          <span className="h-1.5 flex-1 rounded-full bg-surface-container">
            <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${gravando * 100}%` }} />
          </span>
          <button onClick={() => (cancelar.current = true)} className="font-medium text-primary hover:underline">
            Cancelar
          </button>
        </div>
      )}
      {erroBaixar && <p className="mt-2 text-xs text-error">{erroBaixar}</p>}
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

function IconeTelaCheia({ saindo }: { saindo: boolean }) {
  return saindo ? (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /></svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" /></svg>
  );
}

function IconeBaixar() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" /></svg>
  );
}
