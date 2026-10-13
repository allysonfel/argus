// Mapa de calor, zonas mortas e rotas REAIS: calculados a partir dos casos
// (o que o motor viu em cada vídeo de demonstração, ver casos.ts) e da
// geometria de cada câmera (zonas e linhas desenhadas na imagem, vinda do
// motor em /api/cameras). Tudo em coordenadas da imagem (0-1).

import { carregarCaso, carregarIndice, dentro, pe, type Caso, type PessoaCaso, type Poligono } from './casos';

export type ZonaCamera = { id: string; nome: string; poligono: Poligono };
export type LinhaCamera = { id: string; nome: string; inicio: [number, number]; fim: [number, number] };
export type CameraReal = { caso: Caso; zonas: ZonaCamera[]; linhas: LinhaCamera[] };

export async function carregarCamerasReais(urlMotor: string): Promise<CameraReal[]> {
  const [indice, geo] = await Promise.all([
    carregarIndice(urlMotor),
    fetch(`${urlMotor}/api/cameras`).then((r) => (r.ok ? r.json() : [])).catch(() => []) as Promise<{ id: string; zonas?: ZonaCamera[]; linhas?: LinhaCamera[] }[]>,
  ]);
  const casos = await Promise.all(indice.map((i) => carregarCaso(urlMotor, i.camera)));
  return casos
    .map((caso) => {
      const g = geo.find((x) => x.id === caso.camera);
      return { caso, zonas: g?.zonas ?? [], linhas: g?.linhas ?? [] };
    })
    .sort((a, b) => a.caso.nome.localeCompare(b.caso.nome, 'pt-BR', { numeric: true }));
}

// ---------- amostras de posição (pés) ----------

/** Pontos de análise mais afastados que isto = pessoa encoberta: não soma tempo. */
const BURACO_S = 1.5;

export type Amostras = { t: Float32Array; x: Float32Array; y: Float32Array; dt: Float32Array };

const cacheAmostras = new WeakMap<Caso, Amostras>();

/** Posição dos pés de cada pessoa a cada análise, com o tempo que ela ficou ali, em ordem de tempo. */
export function amostras(caso: Caso): Amostras {
  const c = cacheAmostras.get(caso);
  if (c) return c;
  const lista: [number, number, number, number][] = [];
  for (const p of caso.pessoas)
    for (let i = 0; i < p.pontos.length - 1; i++) {
      const dt = p.pontos[i + 1][0] - p.pontos[i][0];
      if (dt <= 0 || dt > BURACO_S) continue;
      const [x, y] = pe(p.pontos[i]);
      lista.push([p.pontos[i][0], x, y, dt]);
    }
  lista.sort((a, b) => a[0] - b[0]);
  const r = {
    t: Float32Array.from(lista, (l) => l[0]),
    x: Float32Array.from(lista, (l) => l[1]),
    y: Float32Array.from(lista, (l) => l[2]),
    dt: Float32Array.from(lista, (l) => l[3]),
  };
  cacheAmostras.set(caso, r);
  return r;
}

/** Pessoa-segundos por minuto de vídeo: o "movimento" da câmera. */
export function movimento(caso: Caso): number {
  const a = amostras(caso);
  let s = 0;
  for (let i = 0; i < a.dt.length; i++) s += a.dt[i];
  return s / Math.max(1 / 60, caso.duracao_s / 60);
}

export function pessoasAgora(caso: Caso, t: number): number {
  let n = 0;
  for (const p of caso.pessoas) if (t >= p.entrada && t <= p.saida) n++;
  return n;
}

// ---------- calor ----------

export const GW = 64;
export const GH = 36;

/** Grade de calor que vai somando conforme o vídeo anda (recomeça se o vídeo volta). */
export class Calor {
  grade = new Float32Array(GW * GH);
  private idx = 0;
  private ate = -1;
  constructor(private am: Amostras) {}

  somarAte(t: number): Float32Array {
    if (t < this.ate) {
      this.grade.fill(0);
      this.idx = 0;
    }
    const am = this.am;
    while (this.idx < am.t.length && am.t[this.idx] <= t) {
      const i = this.idx++;
      const gx = Math.floor(am.x[i] * GW);
      const gy = Math.floor(am.y[i] * GH);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          this.grade[y * GW + x] += am.dt[i] * Math.exp(-(dx * dx + dy * dy) / 2.5);
        }
    }
    this.ate = t;
    return this.grade;
  }
}

export function corCalor(v: number): [number, number, number, number] {
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
  return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k, Math.min(190, 40 + v * 260)];
}

/** Desenha a grade sobre o vídeo (w x h). `offscreen` é reaproveitado entre quadros. */
export function desenharCalor(ctx: CanvasRenderingContext2D, grade: Float32Array, w: number, h: number, offscreen: HTMLCanvasElement) {
  let max = 0;
  for (let i = 0; i < grade.length; i++) max = Math.max(max, grade[i]);
  if (!max) return;
  offscreen.width = GW;
  offscreen.height = GH;
  const o = offscreen.getContext('2d')!;
  const img = o.createImageData(GW, GH);
  for (let i = 0; i < grade.length; i++) {
    const v = grade[i] / max;
    if (v < 0.04) continue;
    img.data.set(corCalor(Math.sqrt(v)), i * 4);
  }
  o.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(offscreen, 0, 0, w, h);
}

// ---------- zonas ----------

function areaPoligono(p: Poligono): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}

export type IndiceZona = { cam: CameraReal; zona: ZonaCamera; pessoaSeg: number; pessoas: number; densidade: number; indice: number };

/** Índice de cada zona desenhada nas câmeras = tempo das pessoas na zona por
 * área da zona e por minuto de vídeo ÷ média de todas as zonas (1 = na média). */
export function indiceZonasReais(cams: CameraReal[]): IndiceZona[] {
  const lista: Omit<IndiceZona, 'indice'>[] = [];
  for (const cam of cams) {
    const minutos = Math.max(1 / 60, cam.caso.duracao_s / 60);
    for (const zona of cam.zonas) {
      let seg = 0;
      let pessoas = 0;
      for (const p of cam.caso.pessoas) {
        let s = 0;
        for (let i = 0; i < p.pontos.length - 1; i++) {
          const dt = p.pontos[i + 1][0] - p.pontos[i][0];
          if (dt > 0 && dt <= BURACO_S && dentro(pe(p.pontos[i]), zona.poligono)) s += dt;
        }
        seg += s;
        if (s > 0) pessoas++;
      }
      lista.push({ cam, zona, pessoaSeg: seg, pessoas, densidade: seg / minutos / Math.max(0.01, areaPoligono(zona.poligono)) });
    }
  }
  const media = lista.reduce((s, z) => s + z.densidade, 0) / Math.max(1, lista.length);
  return lista.map((z) => ({ ...z, indice: media ? z.densidade / media : 0 }));
}

// ---------- rotas ----------

export type Lado = 'esquerda' | 'direita' | 'fundo' | 'frente' | 'meio';
export const NOME_LADO: Record<Lado, string> = { esquerda: 'esquerda', direita: 'direita', fundo: 'fundo', frente: 'frente', meio: 'meio' };
/** "Entrou pela esquerda", "saiu pelo fundo"... */
export const POR_LADO: Record<Lado, string> = { esquerda: 'pela esquerda', direita: 'pela direita', fundo: 'pelo fundo', frente: 'pela frente (perto da câmera)', meio: 'pelo meio da imagem' };

/** Por qual lado da imagem a pessoa entrou/saiu ("meio" = apareceu ou sumiu longe das bordas). */
function lado([x, y]: [number, number]): Lado {
  const d: [Lado, number][] = [
    ['esquerda', x],
    ['direita', 1 - x],
    ['fundo', y],
    ['frente', 1 - y],
  ];
  d.sort((a, b) => a[1] - b[1]);
  return d[0][1] <= 0.15 ? d[0][0] : 'meio';
}

export type Fluxo = { de: Lado; para: Lado; pessoas: PessoaCaso[] };

/** Entrada → saída de cada pessoa (só quem ficou o bastante pra ter um caminho). */
export function fluxos(caso: Caso): Fluxo[] {
  const m = new Map<string, Fluxo>();
  for (const p of caso.pessoas) {
    if (p.pontos.length < 3) continue;
    const de = lado(pe(p.pontos[0]));
    const para = lado(pe(p.pontos[p.pontos.length - 1]));
    const k = `${de}>${para}`;
    if (!m.has(k)) m.set(k, { de, para, pessoas: [] });
    m.get(k)!.pessoas.push(p);
  }
  return [...m.values()].sort((a, b) => b.pessoas.length - a.pessoas.length);
}

/** Ponto médio de cada lado, pra desenhar setas. */
export const PONTO_LADO: Record<Lado, [number, number]> = { esquerda: [0.06, 0.6], direita: [0.94, 0.6], fundo: [0.5, 0.12], frente: [0.5, 0.94], meio: [0.5, 0.55] };

/** Entradas/saídas nas linhas da câmera, pelo trajeto dos pés (mesmo sentido do motor). */
export function passagensLinha(caso: Caso, linha: LinhaCamera): { entradas: number; saidas: number } {
  const [ax, ay] = linha.inicio;
  const vx = linha.fim[0] - ax;
  const vy = linha.fim[1] - ay;
  const comp2 = vx * vx + vy * vy || 1;
  let entradas = 0;
  let saidas = 0;
  for (const p of caso.pessoas) {
    let anterior: [number, number, number] | null = null; // x, y, distância com sinal
    for (const pt of p.pontos) {
      const [x, y] = pe(pt);
      const d = ((x - ax) * vy - (y - ay) * vx) / Math.sqrt(comp2);
      if (Math.abs(d) < 0.008) continue;
      if (anterior && Math.sign(d) !== Math.sign(anterior[2])) {
        const f = anterior[2] / (anterior[2] - d);
        const cx = anterior[0] + (x - anterior[0]) * f;
        const cy = anterior[1] + (y - anterior[1]) * f;
        const u = ((cx - ax) * vx + (cy - ay) * vy) / comp2;
        if (u >= -0.08 && u <= 1.08) {
          if (d < 0) entradas++;
          else saidas++;
        }
      }
      anterior = [x, y, d];
    }
  }
  return { entradas, saidas };
}
