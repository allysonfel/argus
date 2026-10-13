// CASOS REAIS de demonstração: o que o motor de visão viu nos vídeos de
// demonstração (gerado por visao-ia/gerar_casos.py e servido pelo motor em
// /casos). Cada tela calcula seus números a partir dos trajetos das
// pessoas, sincronizados com o vídeo. Nada aqui é simulado: a configuração
// abaixo só diz ONDE ficam as áreas (vitrine, porta, portais) na imagem.

import type { Andar } from './planta';

export const URL_MOTOR = process.env.NEXT_PUBLIC_ARGUS_VISAO_URL || 'http://localhost:8500';

/** [tempo no vídeo (s), x1, y1, x2, y2], caixa normalizada 0-1. */
export type Ponto = [number, number, number, number, number];
export type CorRoupa = { cor: string; pct: number; segunda?: string };
export type PessoaCaso = {
  id: number;
  pontos: Ponto[];
  entrada: number;
  saida: number;
  cima?: CorRoupa;
  baixo?: CorRoupa;
  estatura?: 'crianca' | 'adulto';
  altura_cm?: number;
  recorte?: string;
  t_recorte?: number;
};
export type Caso = {
  camera: string;
  nome: string;
  andar: Andar;
  corredor: string | null;
  credito: string | null;
  video: string;
  duracao_s: number;
  largura: number;
  altura: number;
  fps_analise: number;
  estatura_confiavel: boolean;
  pessoas: PessoaCaso[];
  detectadas_por_quadro: [number, number][];
};
export type ItemIndice = { camera: string; nome: string; andar: Andar; corredor: string | null; duracao_s: number; pessoas: number };

export type Poligono = [number, number][];
export type AreaCaso = { id: string; nome: string; poligono: Poligono; cor: string };

export async function carregarCaso(urlMotor: string, camera: string): Promise<Caso> {
  const r = await fetch(`${urlMotor}/casos/${camera}.json`);
  if (!r.ok) throw new Error(`caso ${camera}: HTTP ${r.status}`);
  return r.json();
}

export async function carregarIndice(urlMotor: string): Promise<ItemIndice[]> {
  const r = await fetch(`${urlMotor}/casos/indice.json`);
  if (!r.ok) throw new Error(`índice de casos: HTTP ${r.status}`);
  return r.json();
}

// ---------- geometria ----------

/** Pés da pessoa (centro da base da caixa). */
export const pe = (p: Ponto): [number, number] => [(p[1] + p[3]) / 2, p[4]];

export function dentro([x, y]: [number, number], poli: Poligono): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i];
    const [xj, yj] = poli[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Caixa da pessoa no instante t (interpolada entre análises), ou null se
 * ela não está na imagem nesse momento. */
export function caixaEm(p: PessoaCaso, t: number): [number, number, number, number] | null {
  if (t < p.entrada - 0.2 || t > p.saida + 0.2) return null;
  const pts = p.pontos;
  let i = 0;
  while (i < pts.length - 1 && pts[i + 1][0] < t) i++;
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  if (b[0] - a[0] > 1.5 && t > a[0] + 0.4 && t < b[0] - 0.4) return null; // buraco: pessoa encoberta
  const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, a[4] + (b[4] - a[4]) * k];
}

/** Segundos que a pessoa passou dentro do polígono (até o instante `ate`). */
export function tempoDentro(p: PessoaCaso, poli: Poligono, ate = Infinity): number {
  let s = 0;
  for (let i = 0; i < p.pontos.length - 1; i++) {
    const a = p.pontos[i];
    if (a[0] >= ate) break;
    const dt = Math.min(p.pontos[i + 1][0], ate) - a[0];
    if (dt < 1.5 && dentro(pe(a), poli)) s += dt;
  }
  return s;
}

export function fmtTempo(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export const fmtSeg = (s: number) => (s >= 90 ? `${(s / 60).toFixed(1).replace('.', ',')} min` : `${Math.round(s)} s`);

// ---------- onde cada câmera de demonstração fica na planta ----------

export const POSICAO_NA_PLANTA: Record<string, { andar: Andar; x: number; y: number; rotulo: string }> = {
  'demo-praca-central': { andar: 'T', x: 500, y: 280, rotulo: 'CAM 01' },
  'demo-corredor-lojas': { andar: 'T', x: 700, y: 280, rotulo: 'CAM 02' },
  'demo-caviar-corredor': { andar: 'T', x: 500, y: 190, rotulo: 'CAM 03' },
  'demo-caviar-fachada': { andar: 'T', x: 515, y: 120, rotulo: 'CAM 04' },
  'demo-escadas-rolantes': { andar: 'T', x: 500, y: 300, rotulo: 'CAM 06' },
  'demo-mezanino': { andar: 'P1', x: 500, y: 280, rotulo: 'CAM 09' },
  'demo-atrio-aereo': { andar: 'P1', x: 470, y: 300, rotulo: 'CAM 10' },
  'demo-praca-alimentacao': { andar: 'P1', x: 400, y: 90, rotulo: 'CAM 11' },
  'demo-quiosques': { andar: 'P1', x: 520, y: 90, rotulo: 'CAM 12' },
  'demo-fast-food': { andar: 'P1', x: 620, y: 90, rotulo: 'CAM 13' },
  'demo-corredor-gastronomico': { andar: 'P1', x: 750, y: 280, rotulo: 'CAM 14' },
  'demo-atrio-decorado': { andar: 'T', x: 460, y: 255, rotulo: 'CAM 05' },
  'demo-hiper-caixas': { andar: 'T', x: 500, y: 470, rotulo: 'CAM 07' },
  'demo-hiper-autoatendimento': { andar: 'T', x: 520, y: 380, rotulo: 'CAM 08' },
  'demo-area-eventos': { andar: 'P1', x: 500, y: 450, rotulo: 'CAM 15' },
};

// ---------- configuração dos casos ----------

/** Loja da Ala Norte (CAM 03 corredor + CAM 04 fachada, CCTV real do
 * CAVIAR): vitrine e porta desenhadas a partir do gabarito manual. */
export const LOJA = {
  camera: 'demo-caviar-corredor',
  cameraFachada: 'demo-caviar-fachada',
  nomeLoja: 'Loja da Ala Norte',
  // Vitrine: só a parte mais perto da câmera; lá no fundo quem anda em
  // direção à câmera parece parado (perspectiva), então não dá pra medir.
  vitrine: { id: 'vitrine', nome: 'Frente da vitrine', poligono: [[0.17, 0.22], [0.42, 0.22], [0.44, 0.6], [0.19, 0.6]], cor: '#10b981' } as AreaCaso,
  // Faixa encostada na fachada (lado esquerdo), onde ficam as portas.
  porta: { id: 'porta', nome: 'Fachada / portas da loja', poligono: [[0.0, 0.18], [0.23, 0.18], [0.33, 1.0], [0.0, 1.0]], cor: '#f59e0b' } as AreaCaso,
  /** Ficou na frente da vitrine pelo menos isto (segundos somados). */
  permanenciaMinS: 15,
  // Contagem feita à mão pelos pesquisadores do CAVIAR, quadro a quadro.
  gabarito: { pessoas: 17, pararamVitrine: 3, entradas: 7, saidas: 5 },
};
