// Resumo de rotas por período (diário a anual), a partir da simulação.
//
// Simular um ano inteiro dia a dia seria lento demais no navegador. Então
// cada dia da semana do período é simulado uma vez (o dia mais recente
// dele) e a proporção das rotas desse dia vale para todos os dias iguais do
// período, pesada pelo movimento de cada dia. Quando as câmeras do shopping
// estiverem ligadas, o mesmo resumo sai das rotas gravadas de cada dia.

import { diaSemana, entradasDia, somarDias, INICIO_HISTORICO } from './demo';
import { ENTRADAS } from './planta';
import { sementeDoDia, simular, type Agente } from './simulacao';

export const PERIODOS_ROTA = [
  { id: 'dia', nome: 'Diário', dias: 1 },
  { id: 'semana', nome: 'Semanal', dias: 7 },
  { id: 'mes', nome: 'Mensal', dias: 30 },
  { id: 'trimestre', nome: 'Trimestral', dias: 91 },
  { id: 'semestre', nome: 'Semestral', dias: 182 },
  { id: 'ano', nome: 'Anual', dias: 365 },
] as const;
export type PeriodoRota = (typeof PERIODOS_ROTA)[number]['id'];

/** Para onde vai quem entrou por uma porta: as 2 áreas depois do hall da porta. */
export type Destino = { caminho: string[]; pessoas: number; pct: number };
export type ResumoEntrada = { entrada: string; hall: string; pessoas: number; pct: number; destinos: Destino[] };
export type ResumoRotas = { inicio: string; fim: string; dias: number; pessoas: number; entradas: ResumoEntrada[]; anterior: number };

const cache = new Map<string, Agente[]>();
function agentesDoDia(dia: string): Agente[] {
  if (!cache.has(dia)) cache.set(dia, simular([], sementeDoDia(dia), dia, true).agentes);
  return cache.get(dia)!;
}

/** A 1ª área depois da porta é quase sempre o hall dela; o destino são as 2 seguintes. */
function destinoDe(a: Agente): string[] {
  return a.areas.slice(2, 4);
}

/** Movimento do período terminando em `fim` (inclusive). */
function intervalo(fim: string, dias: number) {
  const inicio = somarDias(fim, -(dias - 1));
  return { inicio: inicio < INICIO_HISTORICO ? INICIO_HISTORICO : inicio, fim };
}

function totalPessoas(inicio: string, fim: string) {
  let t = 0;
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) t += entradasDia(d);
  return t;
}

export function resumoRotas(fim: string, periodo: PeriodoRota, topDestinos = 4): ResumoRotas {
  const { dias } = PERIODOS_ROTA.find((p) => p.id === periodo)!;
  const { inicio } = intervalo(fim, dias);

  // Peso de cada dia da semana = movimento somado desses dias no período.
  const pesoDia = new Map<number, number>();
  const amostra = new Map<number, string>(); // dia da semana -> dia simulado (o mais recente)
  for (let d = fim; d >= inicio; d = somarDias(d, -1)) {
    const ds = diaSemana(d);
    pesoDia.set(ds, (pesoDia.get(ds) ?? 0) + entradasDia(d));
    if (!amostra.has(ds)) amostra.set(ds, d);
  }

  const porEntrada = new Map<string, number>();
  const porDestino = new Map<string, Map<string, number>>();
  const porHall = new Map<string, Map<string, number>>();
  for (const [ds, dia] of amostra) {
    const ags = agentesDoDia(dia);
    const k = pesoDia.get(ds)! / ags.length; // pessoas reais por visitante simulado
    for (const a of ags) {
      porEntrada.set(a.entrada, (porEntrada.get(a.entrada) ?? 0) + k);
      const m = porDestino.get(a.entrada) ?? new Map<string, number>();
      const chave = destinoDe(a).join('>');
      m.set(chave, (m.get(chave) ?? 0) + k);
      porDestino.set(a.entrada, m);
      const h = porHall.get(a.entrada) ?? new Map<string, number>();
      h.set(a.areas[1] ?? '', (h.get(a.areas[1] ?? '') ?? 0) + k);
      porHall.set(a.entrada, h);
    }
  }

  const pessoas = [...porEntrada.values()].reduce((s, v) => s + v, 0);
  const entradas: ResumoEntrada[] = ENTRADAS.filter((e) => porEntrada.has(e.id))
    .map((e) => {
      const n = porEntrada.get(e.id)!;
      const destinos = [...porDestino.get(e.id)!]
        .map(([k, v]) => ({ caminho: k ? k.split('>') : [], pessoas: v, pct: (100 * v) / n }))
        .filter((d) => d.pct >= 1)
        .sort((a, b) => b.pessoas - a.pessoas)
        .slice(0, topDestinos);
      const hall = [...porHall.get(e.id)!].sort((a, b) => b[1] - a[1])[0][0];
      return { entrada: e.id, hall, pessoas: n, pct: (100 * n) / pessoas, destinos };
    })
    .sort((a, b) => b.pessoas - a.pessoas);

  // Só compara com um período anterior inteiro dentro do histórico.
  const antFim = somarDias(inicio, -1);
  const antIni = somarDias(antFim, -(dias - 1));
  const anterior = antIni >= INICIO_HISTORICO ? totalPessoas(antIni, antFim) : 0;
  return { inicio, fim, dias: Math.round((Date.parse(fim) - Date.parse(inicio)) / 864e5) + 1, pessoas, entradas, anterior };
}
