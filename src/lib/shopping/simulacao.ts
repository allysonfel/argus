// SIMULAÇÃO de um dia do shopping sobre a planta: pessoas virtuais entram
// pelas entradas, andam pelos corredores, visitam lojas, praça de
// alimentação e cinema, trocam de piso pela escada rolante e saem. É
// determinística (mesma semente = mesmo dia) e roda no navegador.
//
// O mapa de calor, as zonas mortas e as rotas saem dos trajetos dessas
// pessoas, do mesmo jeito que sairão das câmeras calibradas na planta
// (cada câmera projeta os pés das pessoas na planta por homografia).

import { PERFIL_HORA, agoraDemo, entradasDia, somarDias } from './demo';
import { CINEMA, ENTRADAS, LIGACOES_ESCADAS, LOJAS, ZONAS, ZONA_ALIMENTACAO, ZONA_CINEMA, type Andar, type Retangulo } from './planta';

export const MIN_DIA = 12 * 60; // 10h às 22h
export const N_AGENTES = 3600;
const PASSO_AMOSTRA = 0.5; // minutos simulados entre amostras de posição
const VEL_PX_MIN = 230; // passeio no shopping (~0,7 m/s, com paradas curtas)

export type Seg = { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number; andar: 0 | 1; vis: boolean };
export type Agente = { id: number; segs: Seg[]; areas: string[]; entrada: string; saidaPor: string; chegada: number; saida: number };
export type Acao = { zonaId: string; multiplicador: number };

export type Simulacao = {
  agentes: Agente[];
  /** Amostras de posição de quem está à vista (corredores, praça, entradas). */
  amostras: { t: Float32Array; andar: Uint8Array; x: Float32Array; y: Float32Array; zona: Int16Array };
  /** Pessoa-minutos por zona no dia inteiro. */
  ocupacaoZona: Record<string, number>;
  /** Pessoas reais representadas por cada ponto. */
  escala: number;
};

export const andarIdx = (a: Andar): 0 | 1 => (a === 'T' ? 0 : 1);
export const horaDoMinuto = (m: number) => {
  const h = 10 + Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- grafo de circulação ----------

type No = { id: string; andar: Andar; rect: Retangulo; area: string };

const NOS: No[] = [
  ...ZONAS.map((z) => ({ id: z.id, andar: z.andar, rect: z.rect, area: z.areaId })),
  ...ENTRADAS.map((e) => ({ id: e.id, andar: e.andar, rect: e.rect, area: e.id })),
];
const IDX = new Map(NOS.map((n, i) => [n.id, i]));
const cx = (r: Retangulo) => r.x + r.w / 2;
const cy = (r: Retangulo) => r.y + r.h / 2;

function encostam(a: Retangulo, b: Retangulo): boolean {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return (ox > 10 && oy > -5) || (oy > 10 && ox > -5);
}

// Floyd-Warshall: próximo passo do caminho mais curto entre quaisquer dois nós.
const PROXIMO: Int16Array = (() => {
  const n = NOS.length;
  const dist = new Float64Array(n * n).fill(Infinity);
  const prox = new Int16Array(n * n).fill(-1);
  const ligar = (i: number, j: number, d: number) => {
    dist[i * n + j] = d;
    dist[j * n + i] = d;
    prox[i * n + j] = j;
    prox[j * n + i] = i;
  };
  for (let i = 0; i < n; i++) {
    dist[i * n + i] = 0;
    prox[i * n + i] = i;
    for (let j = i + 1; j < n; j++)
      if (NOS[i].andar === NOS[j].andar && encostam(NOS[i].rect, NOS[j].rect))
        ligar(i, j, Math.hypot(cx(NOS[i].rect) - cx(NOS[j].rect), cy(NOS[i].rect) - cy(NOS[j].rect)));
  }
  // Escadas rolantes entre o Térreo e o Piso 1.
  for (const [a, b] of LIGACOES_ESCADAS) ligar(IDX.get(a)!, IDX.get(b)!, 160);
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const d = dist[i * n + k] + dist[k * n + j];
        if (d < dist[i * n + j]) {
          dist[i * n + j] = d;
          prox[i * n + j] = prox[i * n + k];
        }
      }
  return prox;
})();

function caminho(de: number, para: number): number[] {
  const n = NOS.length;
  const res = [de];
  let atual = de;
  while (atual !== para && res.length < 60) {
    atual = PROXIMO[atual * n + para];
    if (atual < 0) break;
    res.push(atual);
  }
  return res;
}

// ---------- destinos ----------

type Destino = { tipo: 'loja' | 'parada'; zona: string; peso: number; porta?: [number, number] };

function destinos(acoes: Acao[]): Destino[] {
  const mult = new Map(acoes.map((a) => [a.zonaId, a.multiplicador]));
  const lista: Destino[] = [];
  for (const l of LOJAS) {
    const z = ZONAS.find((zz) => zz.id === l.frenteZonaId)!;
    // Porta: ponto da borda do corredor mais perto do centro da loja.
    const px = Math.min(z.rect.x + z.rect.w - 4, Math.max(z.rect.x + 4, cx(l.rect)));
    const py = Math.min(z.rect.y + z.rect.h - 4, Math.max(z.rect.y + 4, cy(l.rect)));
    lista.push({ tipo: 'loja', zona: z.id, peso: z.peso * l.atracao * (mult.get(z.id) ?? 1), porta: [px, py] });
  }
  // Ação comercial (quiosque, evento): as pessoas param na própria área.
  for (const a of acoes) {
    const z = ZONAS.find((zz) => zz.id === a.zonaId);
    if (z) lista.push({ tipo: 'parada', zona: z.id, peso: Math.pow(z.peso, 2) * (a.multiplicador - 1) * 1.5 });
  }
  return lista;
}

function sortear<T>(itens: T[], peso: (t: T) => number, r: number): T {
  const total = itens.reduce((s, i) => s + peso(i), 0);
  let x = r * total;
  for (const i of itens) {
    x -= peso(i);
    if (x <= 0) return i;
  }
  return itens[itens.length - 1];
}

// ---------- simulação ----------

/** Semente de um dia (mesmo dia = mesma simulação, dias diferentes = movimento diferente). */
export function sementeDoDia(iso: string): number {
  let h = 2166136261;
  for (const ch of iso) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** `dia` (opcional) escala os pontos pelo movimento daquele dia; sem ele, usa ontem.
 * `soRotas` pula as amostras de posição (bem mais rápido; serve para resumir rotas). */
export function simular(acoes: Acao[] = [], semente = 20261012, dia?: string, soRotas = false): Simulacao {
  // Uma sequência aleatória por visitante: simulando uma ação, só muda o
  // que a ação afeta (o resto do dia fica igual, dá pra comparar).
  let rnd = mulberry32(semente);
  const dest = destinos(acoes);
  const lojas = dest.filter((d) => d.tipo === 'loja' || d.tipo === 'parada');
  const horas = Object.keys(PERFIL_HORA).map(Number);
  const agentes: Agente[] = [];

  const pontoEm = (r: Retangulo, folga = 0.25): [number, number] => [r.x + r.w * (folga + (1 - 2 * folga) * rnd()), r.y + r.h * (folga + (1 - 2 * folga) * rnd())];

  for (let id = 0; id < N_AGENTES; id++) {
    rnd = mulberry32(semente + id * 7919);
    const hora = sortear(horas, (h) => PERFIL_HORA[h], rnd());
    const chegada = (hora - 10) * 60 + rnd() * 60;
    if (chegada > MIN_DIA - 25) continue;
    const entrada = sortear(ENTRADAS, (e) => e.peso, rnd());
    const segs: Seg[] = [];
    const areas: string[] = [entrada.id];
    let t = chegada;
    let no = IDX.get(entrada.id)!;
    let [x, y] = pontoEm(entrada.rect, 0.35);
    let andar: Andar = entrada.andar;

    const mover = (px: number, py: number, novoAndar: Andar, vel = VEL_PX_MIN * (0.8 + 0.4 * rnd())) => {
      const d = novoAndar === andar ? Math.hypot(px - x, py - y) : 160;
      const dt = Math.max(0.05, d / vel);
      segs.push({ t0: t, t1: t + dt, x0: x, y0: y, x1: novoAndar === andar ? px : x, y1: novoAndar === andar ? py : y, andar: andarIdx(andar), vis: novoAndar === andar });
      t += dt;
      x = px;
      y = py;
      andar = novoAndar;
    };
    const ficar = (dur: number, vis: boolean, r?: Retangulo) => {
      const fim = Math.min(t + dur, MIN_DIA - 8);
      if (!vis || !r) {
        segs.push({ t0: t, t1: fim, x0: x, y0: y, x1: x, y1: y, andar: andarIdx(andar), vis: false });
        t = Math.max(t, fim);
        return;
      }
      // Visível: anda devagar entre pontos da área (mesas, vitrines).
      while (t < fim) {
        const [px, py] = pontoEm(r, 0.1);
        mover(px, py, andar, 60 + 40 * rnd());
        const pausa = Math.min(fim - t, 1 + 3 * rnd());
        if (pausa > 0) segs.push({ t0: t, t1: t + pausa, x0: x, y0: y, x1: x, y1: y, andar: andarIdx(andar), vis: true });
        t += Math.max(0, pausa);
      }
    };
    const irAte = (alvo: number) => {
      for (const passo of caminho(no, alvo).slice(1)) {
        const n = NOS[passo];
        if (n.andar !== andar) {
          areas.push('escadas');
          mover(x, y, n.andar);
          [x, y] = pontoEm(n.rect);
        }
        const [px, py] = pontoEm(n.rect);
        mover(px, py, n.andar);
        if (areas[areas.length - 1] !== n.area) areas.push(n.area);
        no = passo;
      }
    };

    const visitas = 2 + Math.floor(Math.pow(rnd(), 1.3) * 4);
    for (let v = 0; v < visitas && t < MIN_DIA - 30; v++) {
      const h = 10 + t / 60;
      const almoco = h >= 11.5 && h < 14.5;
      const jantar = h >= 18.5 && h < 21;
      const r = rnd();
      if (r < (almoco ? 0.16 : jantar ? 0.13 : 0.03)) {
        irAte(IDX.get(ZONA_ALIMENTACAO)!);
        ficar(8 + 12 * rnd(), true, ZONAS.find((z) => z.id === ZONA_ALIMENTACAO)!.rect);
      } else if (r < (almoco ? 0.36 : jantar ? 0.33 : 0.28)) {
        // Passeio: anda por um corredor olhando vitrines, sem entrar em loja.
        const zs = ZONAS.filter((z) => z.id !== ZONA_ALIMENTACAO);
        const z = sortear(zs, (zz) => zz.peso, rnd());
        irAte(IDX.get(z.id)!);
        ficar(1.5 + 3 * rnd(), true, z.rect);
      } else if (h >= 13.5 && h < 20 && r > 0.95) {
        irAte(IDX.get(ZONA_CINEMA)!);
        mover(CINEMA.x + 4, cy(CINEMA), andar);
        ficar(110 + 20 * rnd(), false);
        v = visitas; // depois do filme, vai embora
      } else {
        const d = sortear(lojas, (l) => l.peso, rnd());
        irAte(IDX.get(d.zona)!);
        const z = ZONAS.find((zz) => zz.id === d.zona)!;
        if (d.tipo === 'loja' && d.porta) {
          // Metade olha a vitrine antes (à vista, no corredor), depois entra.
          if (rnd() < 0.75) ficar(1 + 2.5 * rnd(), true, { x: d.porta[0] - 25, y: d.porta[1] - 12, w: 50, h: 24 });
          mover(d.porta[0], d.porta[1], andar);
          ficar(3 + 8 * rnd(), false); // dentro da loja: não monitorado
        } else {
          ficar(3 + 6 * rnd(), true, z.rect);
        }
      }
    }
    // Saída: 70% pela mesma entrada.
    const saidaPor = rnd() < 0.7 ? entrada : sortear(ENTRADAS, (e) => e.peso, rnd());
    irAte(IDX.get(saidaPor.id)!);
    const [sx, sy] = pontoEm(saidaPor.rect, 0.35);
    mover(sx, sy, andar);
    agentes.push({ id, segs, areas, entrada: entrada.id, saidaPor: saidaPor.id, chegada, saida: t });
  }

  // Amostras de posição (para calor, ocupação e zonas mortas).
  const ts: number[] = [];
  const as: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const a of soRotas ? [] : agentes)
    for (const s of a.segs) {
      if (!s.vis) continue;
      for (let k = Math.ceil(s.t0 / PASSO_AMOSTRA) * PASSO_AMOSTRA; k < s.t1; k += PASSO_AMOSTRA) {
        const f = s.t1 > s.t0 ? (k - s.t0) / (s.t1 - s.t0) : 0;
        ts.push(k);
        as.push(s.andar);
        xs.push(s.x0 + (s.x1 - s.x0) * f);
        ys.push(s.y0 + (s.y1 - s.y0) * f);
      }
    }
  const ordem = ts.map((_, i) => i).sort((i, j) => ts[i] - ts[j]);
  const amostras = {
    t: Float32Array.from(ordem, (i) => ts[i]),
    andar: Uint8Array.from(ordem, (i) => as[i]),
    x: Float32Array.from(ordem, (i) => xs[i]),
    y: Float32Array.from(ordem, (i) => ys[i]),
    zona: new Int16Array(ordem.length).fill(-1),
  };
  const ocupacaoZona: Record<string, number> = Object.fromEntries(ZONAS.map((z) => [z.id, 0]));
  for (let i = 0; i < amostras.t.length; i++) {
    const andar: Andar = amostras.andar[i] ? 'P1' : 'T';
    const zi = ZONAS.findIndex((z) => z.andar === andar && amostras.x[i] >= z.rect.x && amostras.x[i] <= z.rect.x + z.rect.w && amostras.y[i] >= z.rect.y && amostras.y[i] <= z.rect.y + z.rect.h);
    amostras.zona[i] = zi;
    if (zi >= 0) ocupacaoZona[ZONAS[zi].id] += PASSO_AMOSTRA;
  }

  // Dia de hoje ainda não acabou: usa o mesmo dia da semana passada (dia inteiro).
  const hoje = agoraDemo().data;
  const ref = !dia ? somarDias(hoje, -1) : dia >= hoje ? somarDias(dia, -7) : dia;
  return { agentes, amostras, ocupacaoZona, escala: Math.max(1, Math.round(entradasDia(ref) / agentes.length)) };
}

/** Posição de um agente no minuto t (null se fora do shopping ou dentro de loja/cinema). */
export function posicao(a: Agente, t: number): { x: number; y: number; andar: 0 | 1 } | null {
  if (t < a.chegada || t > a.saida) return null;
  let lo = 0;
  let hi = a.segs.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (a.segs[m].t0 <= t) lo = m;
    else hi = m - 1;
  }
  const s = a.segs[lo];
  if (!s || !s.vis || t > s.t1) return null;
  const f = s.t1 > s.t0 ? (t - s.t0) / (s.t1 - s.t0) : 0;
  return { x: s.x0 + (s.x1 - s.x0) * f, y: s.y0 + (s.y1 - s.y0) * f, andar: s.andar };
}

/** Índice de cada zona = pessoa-minutos por área ÷ média do andar (1 = na média). */
export function indiceZonas(sim: Simulacao): Record<string, number> {
  const res: Record<string, number> = {};
  for (const andar of ['T', 'P1'] as Andar[]) {
    // Praça de alimentação fica fora (uso diferente: as pessoas ficam sentadas).
    const zs = ZONAS.filter((z) => z.andar === andar && z.id !== ZONA_ALIMENTACAO);
    const dens = zs.map((z) => sim.ocupacaoZona[z.id] / (z.rect.w * z.rect.h));
    const media = dens.reduce((s, d) => s + d, 0) / dens.length;
    zs.forEach((z, i) => (res[z.id] = media ? dens[i] / media : 0));
  }
  return res;
}
