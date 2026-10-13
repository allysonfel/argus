'use client';

import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Planta } from '@/components/shopping/Planta';
import { ENTRADAS, ZONAS, type Andar } from '@/lib/shopping/planta';
import { DIAS_SEMANA, agoraDemo, diaSemana, formatarData, somarDias } from '@/lib/shopping/demo';
import { MIN_DIA, andarIdx, horaDoMinuto, posicao, type Agente, type Simulacao } from '@/lib/shopping/simulacao';

// ---------- relógio do dia simulado ----------

// Padrão: tempo real (1 minuto do shopping por minuto de verdade), pra
// apresentação ao vivo. As outras velocidades aceleram o dia.
export const VELOCIDADES = [
  { rotulo: 'Tempo real', minPorSeg: 1 / 60 },
  { rotulo: 'Acelerar: 1 h em 1 min', minPorSeg: 1 },
  { rotulo: 'Acelerar: 1 h em 20 s', minPorSeg: 3 },
  { rotulo: 'Acelerar: 1 h em 5 s', minPorSeg: 12 },
];

export type Relogio = ReturnType<typeof useRelogio>;

/** Minuto do dia agora (0 = 10h), no horário do shopping. */
function minutoAgora(): number {
  const a = agoraDemo();
  return Math.max(0, Math.min(MIN_DIA - 0.01, (a.hora - 10) * 60 + a.minuto));
}

/** Minuto do dia (0 = 10h). `ref` anda a cada quadro (desenho); `t` só ~8x/s (números).
 * Começa AO VIVO: dia de hoje, no horário atual, em tempo real. Mexer no
 * ponteiro, no dia ou na velocidade sai do ao vivo. */
export function useRelogio() {
  const hoje = agoraDemo().data;
  const ref = useRef(0);
  const [t, setT] = useState(0);
  const [tocando, setTocando] = useState(true);
  const [vel, setVelEstado] = useState(0);
  const [dia, setDiaEstado] = useState(hoje);
  const [aoVivo, setAoVivo] = useState(true);
  useEffect(() => {
    // No cliente (o servidor não sabe a hora de quem está vendo)
    ref.current = minutoAgora();
    setT(ref.current);
  }, []);
  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    let ultimo = performance.now();
    let aviso = 0;
    const passo = (agora: number) => {
      ref.current += ((agora - ultimo) / 1000) * VELOCIDADES[vel].minPorSeg;
      if (ref.current >= MIN_DIA) ref.current = 0; // recomeça o dia
      ultimo = agora;
      if (agora - aviso > 120) {
        aviso = agora;
        setT(ref.current);
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [tocando, vel]);
  const irPara = (m: number) => {
    ref.current = Math.max(0, Math.min(MIN_DIA - 0.01, m));
    setT(ref.current);
    setAoVivo(false);
  };
  const setVel = (v: number) => {
    setVelEstado(v);
    if (v !== 0) setAoVivo(false);
  };
  const setDia = (d: string) => {
    setDiaEstado(d);
    setAoVivo(false);
  };
  const voltarAoVivo = () => {
    setDiaEstado(hoje);
    setVelEstado(0);
    setTocando(true);
    ref.current = minutoAgora();
    setT(ref.current);
    setAoVivo(true);
  };
  return { ref, t, tocando, setTocando, vel, setVel, irPara, dia, setDia, hoje, aoVivo, voltarAoVivo };
}

export function ControlesRelogio({ relogio }: { relogio: Relogio }) {
  const { t, tocando, setTocando, vel, setVel, irPara, dia, setDia, hoje, aoVivo, voltarAoVivo } = relogio;
  const minDia = somarDias(hoje, -60);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {aoVivo ? (
          <span className="flex h-8 items-center gap-2 rounded-full bg-error/10 px-3 text-xs font-semibold text-error">
            <span className="h-2 w-2 animate-pulse rounded-full bg-error" /> AO VIVO
          </span>
        ) : (
          <button onClick={voltarAoVivo} className="flex h-8 items-center gap-2 rounded-full border border-outline-variant px-3 text-xs font-medium text-on-surface hover:bg-surface-container-low">
            <span className="h-2 w-2 rounded-full bg-error" /> Voltar ao vivo
          </button>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => setDia(somarDias(dia, -1))} disabled={dia <= minDia} className="h-8 w-8 rounded-sm border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-40" aria-label="Dia anterior">
            ‹
          </button>
          <input type="date" value={dia} min={minDia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} className="h-8 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface" aria-label="Dia" />
          <button onClick={() => setDia(somarDias(dia, 1))} disabled={dia >= hoje} className="h-8 w-8 rounded-sm border border-outline-variant text-on-surface hover:bg-surface-container-low disabled:opacity-40" aria-label="Próximo dia">
            ›
          </button>
        </div>
        <span className="text-xs text-on-surface-variant">
          {dia === hoje ? 'Hoje' : DIAS_SEMANA[diaSemana(dia)]}, {formatarData(dia)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setTocando(!tocando)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary" aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          )}
        </button>
        <span className="w-16 text-2xl font-semibold tabular-nums text-on-surface">{horaDoMinuto(t)}</span>
        <div className="min-w-48 flex-1">
          <input type="range" min={0} max={MIN_DIA} step={1} value={t} onChange={(e) => irPara(Number(e.target.value))} className="w-full" aria-label="Hora do dia" />
          <div className="flex justify-between text-[10px] tabular-nums text-on-surface-variant">
            {[10, 12, 14, 16, 18, 20, 22].map((h) => (
              <button key={h} onClick={() => irPara((h - 10) * 60)} className="hover:text-on-surface">
                {h}h
              </button>
            ))}
          </div>
        </div>
        <select value={vel} onChange={(e) => setVel(Number(e.target.value))} className="h-9 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface" aria-label="Velocidade">
          {VELOCIDADES.map((v, i) => (
            <option key={v.rotulo} value={i}>
              {v.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SeletorAndar({ andar, setAndar }: { andar: Andar; setAndar: (a: Andar) => void }) {
  return (
    <div className="flex rounded-sm bg-surface-container p-1">
      {(['T', 'P1'] as Andar[]).map((a) => (
        <button key={a} onClick={() => setAndar(a)} className={`h-8 rounded-sm px-3 text-sm font-medium ${andar === a ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
          {a === 'T' ? 'Térreo' : 'Piso 1'}
        </button>
      ))}
    </div>
  );
}

// ---------- mapa ----------

const GW = 125;
const GH = 70; // grade do calor: células de 8 px na planta (1000 x 560)

// Onde dá pra andar (corredores, praças e entradas): o calor só aparece aí.
function mascara(andar: Andar): Uint8Array {
  const m = new Uint8Array(GW * GH);
  const rects = [...ZONAS.filter((z) => z.andar === andar).map((z) => z.rect), ...ENTRADAS.filter((e) => e.andar === andar).map((e) => e.rect)];
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = (i + 0.5) * 8;
      const y = (j + 0.5) * 8;
      if (rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) m[j * GW + i] = 1;
    }
  return m;
}

function corCalor(v: number): [number, number, number, number] {
  const pares: [number, [number, number, number]][] = [
    [0, [59, 130, 246]],
    [0.35, [16, 185, 129]],
    [0.65, [250, 204, 21]],
    [1, [220, 38, 38]],
  ];
  let i = 0;
  while (i < pares.length - 2 && v > pares[i + 1][0]) i++;
  const [a, ca] = pares[i];
  const [b, cb] = pares[i + 1];
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k, Math.min(215, 70 + v * 300)];
}

type Props = {
  sim: Simulacao;
  andar: Andar;
  relogio: Relogio;
  /** Calor: do dia até agora, só da última hora, ou desligado. */
  calor?: 'dia' | 'hora' | null;
  /** Agentes destacados (os demais ficam apagados). */
  destaque?: Set<number> | null;
  /** Desenha o caminho completo dos destacados. */
  trilhas?: boolean;
  planta?: Omit<ComponentProps<typeof Planta>, 'andar'>;
};

export function MapaSimulacao({ sim, andar, relogio, calor = null, destaque = null, trilhas = false, planta }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const masc = useMemo(() => mascara(andar), [andar]);
  const estado = useRef<{ grade: Float32Array; ate: number; idx: number; chave: string } | null>(null);
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  const props = useRef({ sim, andar, calor, destaque, trilhas });
  props.current = { sim, andar, calor, destaque, trilhas };

  useEffect(() => {
    let raf = 0;
    const desenhar = () => {
      const c = canvas.current;
      const { sim, andar, calor, destaque, trilhas } = props.current;
      if (c) {
        const w = c.clientWidth;
        const h = c.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const ctx = c.getContext('2d')!;
        const k = w / 1000;
        ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
        ctx.clearRect(0, 0, 1000, 560);
        const t = relogio.ref.current;
        const ai = andarIdx(andar);

        if (calor) {
          atualizarCalor(t, calor, ai);
          if (offscreen.current) {
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(offscreen.current, 0, 0, 1000, 560);
          }
        }

        if (trilhas && destaque) {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(37, 99, 235, 0.22)';
          let n = 0;
          for (const a of sim.agentes) {
            if (!destaque.has(a.id) || n++ > 120) continue;
            ctx.beginPath();
            for (const s of a.segs) {
              if (s.andar !== ai || !s.vis) continue;
              ctx.moveTo(s.x0, s.y0);
              ctx.lineTo(s.x1, s.y1);
            }
            ctx.stroke();
          }
        }

        for (const a of sim.agentes) {
          const p = posicao(a, t);
          if (!p || p.andar !== ai) continue;
          const dest = !destaque || destaque.has(a.id);
          ctx.beginPath();
          ctx.arc(p.x, p.y, dest ? 4.2 : 2.6, 0, Math.PI * 2);
          ctx.fillStyle = dest ? (destaque ? '#2563eb' : '#1e293b') : 'rgba(100, 116, 139, 0.35)';
          ctx.fill();
          if (dest) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(desenhar);
    };
    raf = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Soma as amostras de posição na grade, incrementalmente enquanto o tempo anda. */
  function atualizarCalor(t: number, modo: 'dia' | 'hora', ai: number) {
    const { sim } = props.current;
    const am = sim.amostras;
    const chave = `${modo}|${ai}|${am.t.length}`;
    const desde = modo === 'hora' ? t - 60 : -1;
    let e = estado.current;
    if (!e || e.chave !== chave || t < e.ate || modo === 'hora') {
      e = estado.current = { grade: new Float32Array(GW * GH), ate: desde, idx: 0, chave };
      while (e.idx < am.t.length && am.t[e.idx] <= desde) e.idx++;
    }
    if (Math.abs(t - e.ate) < 0.25 && offscreen.current) return;
    while (e.idx < am.t.length && am.t[e.idx] <= t) {
      const i = e.idx++;
      if (am.andar[i] !== ai) continue;
      const gx = Math.floor(am.x[i] / 8);
      const gy = Math.floor(am.y[i] / 8);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          e.grade[y * GW + x] += Math.exp(-(dx * dx + dy * dy) / 3);
        }
    }
    e.ate = t;
    if (!offscreen.current) {
      offscreen.current = document.createElement('canvas');
      offscreen.current.width = GW;
      offscreen.current.height = GH;
    }
    let max = 0;
    for (let i = 0; i < e.grade.length; i++) if (masc[i]) max = Math.max(max, e.grade[i]);
    const ctx = offscreen.current.getContext('2d')!;
    const img = ctx.createImageData(GW, GH);
    for (let i = 0; i < e.grade.length; i++) {
      if (!masc[i] || e.grade[i] <= 0 || !max) continue;
      // raiz: realça as áreas medianas (sem ela, só a praça aparece)
      img.data.set(corCalor(Math.sqrt(e.grade[i] / max)), i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }

  return (
    <div className="relative">
      <Planta andar={andar} {...planta} />
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/** Quantos agentes estão no shopping (visíveis ou dentro de lojas) no minuto t. */
export function noShopping(agentes: Agente[], t: number) {
  let n = 0;
  for (const a of agentes) if (t >= a.chegada && t <= a.saida) n++;
  return n;
}
