'use client';

import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Planta, type EstiloMapa } from '@/components/shopping/Planta';
import { ENTRADAS, FUNDO, ZONAS, type Andar } from '@/lib/shopping/planta';
import { ESBOCO, type Poligono } from '@/lib/shopping/plantaEsboco';
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

// Onde dá pra andar: os corredores e o estacionamento extraídos da planta
// oficial (formato exato) + as entradas. O calor só aparece aí.
function dentroPoli(x: number, y: number, p: Poligono): boolean {
  let d = false;
  for (const anel of p)
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i];
      const [xj, yj] = anel[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
    }
  return d;
}

function mascara(andar: Andar): Uint8Array {
  const m = new Uint8Array(GW * GH);
  const polis = [...ESBOCO[andar].corredores, ...ESBOCO[andar].estacionamento];
  const rects = [...ENTRADAS.filter((e) => e.andar === andar).map((e) => e.rect), ...ZONAS.filter((z) => z.andar === andar).map((z) => z.rect)];
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const x = (i + 0.5) * 8;
      const y = (j + 0.5) * 8;
      const noCorredor = polis.some((p) => dentroPoli(x, y, p));
      // Zonas fora do desenho extraído (ex.: retângulo que passa um pouco da borda) não contam.
      if (noCorredor || rects.slice(0, ENTRADAS.length).some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) m[j * GW + i] = 1;
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
  /** Rastro curto atrás de cada pessoa. */
  rastro?: boolean;
  planta?: Omit<ComponentProps<typeof Planta>, 'andar'>;
};

export function MapaSimulacao({ sim, andar, relogio, calor = null, destaque = null, trilhas = false, rastro = false, planta }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const masc = useMemo(() => mascara(andar), [andar]);
  const [estilo, setEstilo] = useState<EstiloMapa>('planta');
  useEffect(() => {
    try {
      const salvo = localStorage.getItem('argus-estilo-planta');
      if (salvo === 'esboco' || salvo === 'mapa') setEstilo('mapa');
      else if (salvo === 'hibrido') setEstilo('hibrido');
    } catch {}
  }, []);
  const mudarEstilo = (e: EstiloMapa) => {
    setEstilo(e);
    try {
      localStorage.setItem('argus-estilo-planta', e);
    } catch {}
  };
  const estado = useRef<{ grade: Float32Array; ate: number; idx: number; chave: string } | null>(null);
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  const props = useRef({ sim, andar, calor, destaque, trilhas, rastro });
  props.current = { sim, andar, calor, destaque, trilhas, rastro };

  useEffect(() => {
    let raf = 0;
    const desenhar = () => {
      const c = canvas.current;
      const { sim, andar, calor, destaque, trilhas, rastro } = props.current;
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
          // Rastro: por onde a pessoa passou nos últimos minutos (some aos poucos).
          if (rastro && dest) {
            let ant = p;
            for (let k = 1; k <= 8; k++) {
              const q = posicao(a, t - k * 0.35);
              if (!q || q.andar !== ai || Math.hypot(q.x - ant.x, q.y - ant.y) > 60) break;
              ctx.beginPath();
              ctx.moveTo(ant.x, ant.y);
              ctx.lineTo(q.x, q.y);
              ctx.strokeStyle = `rgba(37, 99, 235, ${0.55 * (1 - k / 9)})`;
              ctx.lineWidth = 2.6 - k * 0.22;
              ctx.lineCap = 'round';
              ctx.stroke();
              ant = q;
            }
          }
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
    // Escala pelo percentil 92 (não pelo máximo): a praça de alimentação,
    // onde as pessoas ficam sentadas, não apaga o resto do shopping.
    const vals: number[] = [];
    for (let i = 0; i < e.grade.length; i++) if (masc[i] && e.grade[i] > 0) vals.push(e.grade[i]);
    vals.sort((a, b) => a - b);
    const max = vals.length ? vals[Math.floor(vals.length * 0.92)] : 0;
    const ctx = offscreen.current.getContext('2d')!;
    const img = ctx.createImageData(GW, GH);
    for (let i = 0; i < e.grade.length; i++) {
      if (!masc[i] || e.grade[i] <= 0 || !max) continue;
      // raiz: realça as áreas medianas (sem ela, só a praça aparece)
      img.data.set(corCalor(Math.min(1, Math.sqrt(e.grade[i] / max))), i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }

  return (
    <div className="relative">
      <Planta andar={andar} estilo={estilo} {...planta} />
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      <SeletorVisao andar={andar} estilo={estilo} mudar={mudarEstilo} />
    </div>
  );
}

// ---------- visões do mapa (como as camadas do Google Maps) ----------

const VISOES: { id: EstiloMapa; nome: string; dica: string }[] = [
  { id: 'mapa', nome: 'Mapa', dica: 'Desenho limpo: corredores, lojas e estacionamento' },
  { id: 'planta', nome: 'Planta', dica: 'Planta oficial do shopping, com o nome das lojas' },
  { id: 'hibrido', nome: 'Híbrido', dica: 'Planta oficial com os corredores destacados por cima' },
];

const tracado = (p: Poligono) => p.map((a) => `M${a.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('');

function Miniatura({ andar, estilo }: { andar: Andar; estilo: EstiloMapa }) {
  const f = FUNDO[andar];
  const e = ESBOCO[andar];
  return (
    <svg viewBox="0 0 1000 560" className="block h-full w-full" aria-hidden>
      <rect width="1000" height="560" fill="var(--viz-fundo)" />
      {estilo !== 'mapa' && <image href={f.src} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="none" />}
      {estilo === 'mapa' && (
        <>
          {e.contorno.map((p, i) => <path key={`c${i}`} d={tracado(p)} fill="var(--viz-loja)" fillRule="evenodd" />)}
          {e.lojas.map((p, i) => <path key={`l${i}`} d={tracado(p)} fill="var(--viz-neutro)" />)}
          {e.corredores.map((p, i) => <path key={`r${i}`} d={tracado(p)} fill="var(--viz-fundo)" fillRule="evenodd" />)}
        </>
      )}
      {estilo === 'hibrido' && e.corredores.map((p, i) => <path key={`h${i}`} d={tracado(p)} fill="rgba(37, 99, 235, 0.18)" stroke="rgba(37, 99, 235, 0.8)" strokeWidth="6" fillRule="evenodd" />)}
    </svg>
  );
}

/** Botão no canto do mapa: mostra a visão atual e abre as 3 opções com miniatura. */
function SeletorVisao({ andar, estilo, mudar }: { andar: Andar; estilo: EstiloMapa; mudar: (e: EstiloMapa) => void }) {
  const [aberto, setAberto] = useState(false);
  const atual = VISOES.find((v) => v.id === estilo)!;
  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-end gap-2">
      <button onClick={() => setAberto(!aberto)} title="Trocar a visão do mapa" aria-expanded={aberto} className="group relative h-16 w-20 overflow-hidden rounded-md bg-surface shadow-md ring-2 ring-surface transition-shadow hover:ring-primary">
        <Miniatura andar={andar} estilo={estilo} />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent pb-1 pt-3 text-[11px] font-semibold text-white">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M8 2 1.5 5.5 8 9l6.5-3.5zM1.5 8.5 8 12l6.5-3.5" strokeLinejoin="round" />
          </svg>
          {atual.nome}
        </span>
      </button>
      {aberto && (
        <div className="flex gap-2 rounded-lg bg-surface p-2 shadow-lg ring-1 ring-outline-variant">
          {VISOES.map((v) => (
            <button key={v.id} onClick={() => { mudar(v.id); setAberto(false); }} title={v.dica} className="flex w-20 flex-col items-center gap-1 text-[11px] font-medium">
              <span className={`block h-12 w-full overflow-hidden rounded ring-2 transition-shadow ${estilo === v.id ? 'ring-primary' : 'ring-transparent hover:ring-outline-variant'}`}>
                <Miniatura andar={andar} estilo={v.id} />
              </span>
              <span className={estilo === v.id ? 'text-primary' : 'text-on-surface-variant'}>{v.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Quantos agentes estão no shopping (visíveis ou dentro de lojas) no minuto t. */
export function noShopping(agentes: Agente[], t: number) {
  let n = 0;
  for (const a of agentes) if (t >= a.chegada && t <= a.saida) n++;
  return n;
}
