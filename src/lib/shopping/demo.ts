// Gerador de DADOS DE DEMONSTRAÇÃO do painel do Shopping Caruaru.
//
// Nada aqui vem de câmera: é um modelo determinístico (mesmo resultado a
// cada carregamento) com perfil por hora, dia da semana, sazonalidade,
// datas comerciais, crescimento ano a ano e ruído. Toda tela que usa isto
// mostra o selo "Dados de demonstração". Quando o banco agregado do motor
// estiver pronto (etapa 4), estas funções são trocadas por consultas.

import { AREAS, ENTRADAS, ZONAS, centro, centroArea, type Andar, type Zona } from './planta';
import { datasComerciais, janela } from './datasComerciais';

export const HORA_ABRE = 10;
export const HORA_FECHA = 22;
export const HORAS = Array.from({ length: HORA_FECHA - HORA_ABRE }, (_, i) => HORA_ABRE + i);
export const INICIO_HISTORICO = '2025-01-01';

const PERFIL_HORA: Record<number, number> = { 10: 0.35, 11: 0.55, 12: 0.85, 13: 0.9, 14: 0.7, 15: 0.7, 16: 0.8, 17: 0.95, 18: 1.0, 19: 1.0, 20: 0.85, 21: 0.55 };
// 0 = domingo
const FATOR_DIA_SEMANA = [1.2, 0.75, 0.8, 0.85, 0.9, 1.1, 1.4];
const FATOR_MES = [0.9, 0.85, 0.9, 0.92, 1.0, 1.1, 1.05, 0.95, 0.92, 1.0, 1.05, 1.3];
const IMPULSO_DATA: Record<string, number> = { carnaval: 0.75, pascoa: 1.08, maes: 1.25, namorados: 1.1, saojoao: 1.15, pais: 1.15, criancas: 1.2, blackfriday: 1.5, natal: 1.45 };

const ENTRADAS_BASE_HORA = 3100;
const ZONA_BASE_HORA = 950;

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------- utilidades de data ----------

export function somarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diaSemana(iso: string): number {
  return new Date(iso + 'T12:00:00Z').getUTCDay();
}

export function diasEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function formatarNumero(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

/** "Agora" do painel no fuso de Caruaru (UTC-3). Fora do horário de
 *  funcionamento, simula 17:30 do dia — e avisa (`simulado`). */
export function agoraDemo(): { data: string; hora: number; minuto: number; simulado: boolean } {
  const recife = new Date(Date.now() - 3 * 3600 * 1000);
  const data = recife.toISOString().slice(0, 10);
  const hora = recife.getUTCHours();
  const minuto = recife.getUTCMinutes();
  if (hora < HORA_ABRE || hora >= HORA_FECHA) return { data, hora: 17, minuto: 30, simulado: true };
  return { data, hora, minuto, simulado: false };
}

// ---------- modelo ----------

export function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const cacheSazonal = new Map<string, number>();
function fatorSazonal(iso: string): number {
  const c = cacheSazonal.get(iso);
  if (c !== undefined) return c;
  const ano = Number(iso.slice(0, 4));
  let f = FATOR_MES[Number(iso.slice(5, 7)) - 1];
  for (const dc of datasComerciais(ano)) {
    const [ini, fim] = janela(dc);
    if (iso >= ini && iso <= fim) {
      // Natal cresce até a véspera; demais datas, impulso fixo na janela.
      if (dc.id === 'natal') {
        const total = dc.diasAntes;
        const passados = diasEntre(ini, iso).length;
        f *= 1 + (IMPULSO_DATA.natal - 1) * (passados / total);
      } else {
        f *= IMPULSO_DATA[dc.id] ?? 1;
      }
    }
  }
  // Crescimento de ~6% ao ano, contínuo
  const anos = (new Date(iso).getTime() - new Date(INICIO_HISTORICO).getTime()) / (365 * 86400000);
  f *= 1 + 0.06 * anos;
  cacheSazonal.set(iso, f);
  return f;
}

function fatorDia(iso: string, chave: string): number {
  return FATOR_DIA_SEMANA[diaSemana(iso)] * fatorSazonal(iso) * (0.93 + 0.14 * hash(`${chave}|${iso}`));
}

function ruido(chave: string): number {
  return 0.88 + 0.24 * hash(chave);
}

// Ações registradas pela administração (demonstração). O efeito no fluxo
// é SIMULADO aqui pra a comparação antes/depois ter o que mostrar.
export type AcaoZona = { id: string; zonaId: string; data: string; descricao: string; autor: string; efeitoSimulado: number };
export const ACOES_DEMO: AcaoZona[] = [
  { id: 'a1', zonaId: 'P1-C7-n', data: '2026-08-14', descricao: 'Quiosque de açaí instalado', autor: 'Marketing', efeitoSimulado: 1.45 },
  { id: 'a2', zonaId: 'P1-C8-s', data: '2026-09-05', descricao: 'Sinalização nova apontando para a Ala Leste', autor: 'Operações', efeitoSimulado: 1.08 },
];

/** Pessoas que passaram por uma zona numa hora. */
export function fluxoZonaHora(z: Zona, iso: string, hora: number): number {
  const p = PERFIL_HORA[hora];
  if (!p) return 0;
  const acao = ACOES_DEMO.find((a) => a.zonaId === z.id && iso >= a.data);
  const efeito = acao ? acao.efeitoSimulado : 1;
  // Praça de alimentação tem pico de almoço/jantar mais forte
  const ajuste = z.areaId === 'P1-alim' ? (hora === 12 || hora === 13 || hora === 19 ? 1.35 : hora < 12 ? 0.6 : 1) : 1;
  return Math.round(ZONA_BASE_HORA * z.peso * p * ajuste * efeito * fatorDia(iso, 'z') * ruido(`${z.id}|${iso}|${hora}`));
}

export function entradasHora(entradaId: string, iso: string, hora: number): number {
  const e = ENTRADAS.find((x) => x.id === entradaId)!;
  const p = PERFIL_HORA[hora];
  if (!p) return 0;
  return Math.round(ENTRADAS_BASE_HORA * e.peso * p * fatorDia(iso, 'e') * ruido(`${e.id}|${iso}|${hora}`));
}

/** Limite de hora pro dia de hoje (só conta até "agora"). */
function horasDoDia(iso: string): number[] {
  const agora = agoraDemo();
  if (iso > agora.data) return [];
  if (iso < agora.data) return HORAS;
  return HORAS.filter((h) => h <= agora.hora);
}

function fracaoHora(iso: string, hora: number): number {
  const agora = agoraDemo();
  return iso === agora.data && hora === agora.hora ? agora.minuto / 60 : 1;
}

const cacheZonaDia = new Map<string, number>();
export function fluxoZonaDia(z: Zona, iso: string, horas?: number[]): number {
  const usarCache = !horas;
  const chave = `${z.id}|${iso}`;
  if (usarCache && cacheZonaDia.has(chave) && iso < agoraDemo().data) return cacheZonaDia.get(chave)!;
  const hs = (horas ?? HORAS).filter((h) => horasDoDia(iso).includes(h));
  const total = hs.reduce((acc, h) => acc + fluxoZonaHora(z, iso, h) * fracaoHora(iso, h), 0);
  if (usarCache) cacheZonaDia.set(chave, total);
  return total;
}

export function entradasDia(iso: string): number {
  return horasDoDia(iso).reduce((acc, h) => acc + ENTRADAS.reduce((s, e) => s + entradasHora(e.id, iso, h), 0) * fracaoHora(iso, h), 0);
}

export function entradasPorHora(iso: string): { hora: number; valor: number | null }[] {
  const hs = horasDoDia(iso);
  return HORAS.map((h) => ({ hora: h, valor: hs.includes(h) ? Math.round(ENTRADAS.reduce((s, e) => s + entradasHora(e.id, iso, h), 0) * fracaoHora(iso, h)) : null }));
}

export function entradasPorPortaDia(iso: string): { id: string; nome: string; valor: number }[] {
  const hs = horasDoDia(iso);
  return ENTRADAS.map((e) => ({ id: e.id, nome: e.nome, valor: Math.round(hs.reduce((s, h) => s + entradasHora(e.id, iso, h) * fracaoHora(iso, h), 0)) }));
}

/** Ocupação estimada agora: quem entrou na última ~1h30 e ainda não saiu. */
export function ocupacaoAgora(): number {
  const { data, hora, minuto } = agoraDemo();
  const ent = (h: number) => ENTRADAS.reduce((s, e) => s + entradasHora(e.id, data, h), 0);
  return Math.round(ent(hora) * (minuto / 60) * 0.95 + ent(hora - 1) * 0.75 + ent(hora - 2) * 0.3);
}

// ---------- escopos (shopping, andar, corredor, zona) ----------

export type Escopo = { tipo: 'shopping' } | { tipo: 'andar'; andar: Andar } | { tipo: 'corredor'; corredor: string } | { tipo: 'zona'; zonaId: string };

export function zonasDoEscopo(e: Escopo): Zona[] {
  if (e.tipo === 'andar') return ZONAS.filter((z) => z.andar === e.andar);
  if (e.tipo === 'corredor') return ZONAS.filter((z) => z.corredor === e.corredor);
  if (e.tipo === 'zona') return ZONAS.filter((z) => z.id === e.zonaId);
  return ZONAS;
}

export function nomeEscopo(e: Escopo): string {
  if (e.tipo === 'shopping') return 'Shopping inteiro (entradas)';
  if (e.tipo === 'andar') return e.andar === 'T' ? 'Térreo' : 'Piso 1';
  if (e.tipo === 'corredor') return e.corredor;
  return ZONAS.find((z) => z.id === e.zonaId)?.nome ?? e.zonaId;
}

/** Valor diário do escopo: entradas (shopping) ou passagens nas zonas. */
export function valorDia(e: Escopo, iso: string): number {
  if (e.tipo === 'shopping') return entradasDia(iso);
  return zonasDoEscopo(e).reduce((s, z) => s + fluxoZonaDia(z, iso), 0);
}

export function serieDiaria(e: Escopo, inicio: string, fim: string): { data: string; valor: number }[] {
  return diasEntre(inicio, fim).map((d) => ({ data: d, valor: Math.round(valorDia(e, d)) }));
}

export function corredores(): string[] {
  return [...new Set(ZONAS.map((z) => z.corredor))];
}

// ---------- ranking, calor, zonas mortas ----------

export type FiltroHorario = { diasSemana?: number[]; horaIni?: number; horaFim?: number };

function horasFiltro(f: FiltroHorario): number[] {
  return HORAS.filter((h) => h >= (f.horaIni ?? HORA_ABRE) && h < (f.horaFim ?? HORA_FECHA));
}

function diasFiltro(inicio: string, fim: string, f: FiltroHorario): string[] {
  return diasEntre(inicio, fim).filter((d) => !f.diasSemana?.length || f.diasSemana.includes(diaSemana(d)));
}

export function calorPorZona(inicio: string, fim: string, f: FiltroHorario = {}): Record<string, number> {
  const dias = diasFiltro(inicio, fim, f);
  const hs = horasFiltro(f);
  const completo = hs.length === HORAS.length;
  const out: Record<string, number> = {};
  for (const z of ZONAS) {
    const total = dias.reduce((s, d) => s + fluxoZonaDia(z, d, completo ? undefined : hs), 0);
    // Densidade: passagens por 1.000 px² de área (zonas têm tamanhos diferentes)
    out[z.id] = dias.length ? total / dias.length / ((z.rect.w * z.rect.h) / 1000) : 0;
  }
  return out;
}

export type LinhaRanking = { zona: Zona; total: number; mediaHora: number; picoHora: number; picoValor: number; permanenciaS: number };

export function rankingZonas(inicio: string, fim: string, andar?: Andar): LinhaRanking[] {
  const dias = diasEntre(inicio, fim);
  return ZONAS.filter((z) => !andar || z.andar === andar)
    .map((z) => {
      const porHora = HORAS.map((h) => dias.reduce((s, d) => s + (horasDoDia(d).includes(h) ? fluxoZonaHora(z, d, h) : 0), 0));
      const total = porHora.reduce((a, b) => a + b, 0);
      const pico = porHora.indexOf(Math.max(...porHora));
      const horasAbertas = dias.reduce((s, d) => s + horasDoDia(d).length, 0) || 1;
      return {
        zona: z,
        total,
        mediaHora: total / horasAbertas,
        picoHora: HORAS[pico],
        picoValor: Math.round(porHora[pico] / Math.max(1, dias.length)),
        permanenciaS: Math.round(z.permanenciaBaseS * (0.85 + 0.3 * hash(z.id + inicio))),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function fluxoZonaPorHora(zonaId: string, inicio: string, fim: string): { hora: number; media: number }[] {
  const z = ZONAS.find((x) => x.id === zonaId)!;
  const dias = diasEntre(inicio, fim);
  return HORAS.map((h) => {
    const validos = dias.filter((d) => horasDoDia(d).includes(h));
    return { hora: h, media: validos.length ? Math.round(validos.reduce((s, d) => s + fluxoZonaHora(z, d, h), 0) / validos.length) : 0 };
  });
}

export type ZonaMorta = { zona: Zona; indice: number; media: number; mediaAndar: number; horasMaisVazias: number[]; semanasAbaixo: number; morta: boolean };

/** Índice de movimento de cada zona vs média do andar, semana a semana. */
export function zonasMortas(fim: string, semanasMin = 2, limite = 0.4, semanasAnalise = 6): ZonaMorta[] {
  const res: ZonaMorta[] = [];
  const andares: Andar[] = ['T', 'P1'];
  const indices: Record<string, number[]> = {};
  for (let s = 0; s < semanasAnalise; s++) {
    const fimS = somarDias(fim, -7 * s);
    const iniS = somarDias(fimS, -6);
    const dias = diasEntre(iniS, fimS);
    for (const a of andares) {
      const zs = ZONAS.filter((z) => z.andar === a && z.areaId !== 'P1-alim');
      const dens = zs.map((z) => dias.reduce((t, d) => t + fluxoZonaDia(z, d), 0) / ((z.rect.w * z.rect.h) / 1000));
      const media = dens.reduce((x, y) => x + y, 0) / dens.length;
      zs.forEach((z, i) => (indices[z.id] ??= []).push(dens[i] / media));
    }
  }
  for (const z of ZONAS) {
    const idx = indices[z.id];
    if (!idx) continue;
    let semanasAbaixo = 0;
    for (const v of idx) {
      if (v < limite) semanasAbaixo++;
      else break;
    }
    const porHora = fluxoZonaPorHora(z.id, somarDias(fim, -13), fim);
    const horasMaisVazias = [...porHora].sort((a, b) => a.media - b.media).slice(0, 3).map((h) => h.hora);
    const iniUlt = somarDias(fim, -13);
    const media = diasEntre(iniUlt, fim).reduce((t, d) => t + fluxoZonaDia(z, d), 0) / 14;
    const mesmosAndar = ZONAS.filter((o) => o.andar === z.andar && o.areaId !== 'P1-alim');
    const mediaAndar = mesmosAndar.reduce((t, o) => t + diasEntre(iniUlt, fim).reduce((u, d) => u + fluxoZonaDia(o, d), 0) / 14, 0) / mesmosAndar.length;
    res.push({ zona: z, indice: idx[0], media, mediaAndar, horasMaisVazias, semanasAbaixo, morta: semanasAbaixo >= semanasMin });
  }
  return res.sort((a, b) => a.indice - b.indice);
}

// ---------- rotas e fluxo (modelo de transições entre áreas) ----------

export const LIGACOES: [string, string][] = [
  ['ent-principal', 'T-oeste'],
  ['ent-estac', 'T-leste'],
  ['ent-norte', 'T-norte'],
  ['ent-sul', 'T-sul'],
  ['T-oeste', 'T-praca'],
  ['T-leste', 'T-praca'],
  ['T-norte', 'T-praca'],
  ['T-sul', 'T-praca'],
  ['T-praca', 'escadas'],
  ['escadas', 'P1-praca'],
  ['P1-praca', 'P1-oeste'],
  ['P1-praca', 'P1-leste'],
  ['P1-praca', 'P1-alim'],
  ['P1-praca', 'P1-sul'],
];

function pesoArea(id: string): number {
  if (id === 'escadas') return 2.2;
  const zs = ZONAS.filter((z) => z.areaId === id);
  return zs.reduce((s, z) => s + z.peso, 0) || 1;
}

function vizinhos(id: string): string[] {
  return LIGACOES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

/** Probabilidade de ir de `de` para cada vizinho (proporcional à atratividade). */
function transicoes(de: string, veioDe?: string): { para: string; p: number }[] {
  const vs = vizinhos(de).filter((v) => v !== veioDe && !v.startsWith('ent-'));
  const saida = de.startsWith('ent-') ? 0 : 0.25; // chance de sair/encerrar a visita nesta área
  const pesos = vs.map((v) => pesoArea(v));
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  return vs.map((v, i) => ({ para: v, p: ((1 - saida) * pesos[i]) / soma }));
}

export type Rota = { caminho: string[]; p: number };

export function rotasAPartirDe(entradaId: string, passos = 4, top = 6): Rota[] {
  const rotas: Rota[] = [];
  function andar(caminho: string[], p: number) {
    const atual = caminho[caminho.length - 1];
    const ts = transicoes(atual, caminho[caminho.length - 2]);
    if (caminho.length > passos || ts.length === 0) {
      rotas.push({ caminho, p });
      return;
    }
    const continua = ts.reduce((s, t) => s + t.p, 0);
    if (caminho.length > 1 && continua < 1) rotas.push({ caminho, p: p * (1 - continua) });
    for (const t of ts) andar([...caminho, t.para], p * t.p);
  }
  andar([entradaId], 1);
  return rotas.sort((a, b) => b.p - a.p).slice(0, top);
}

/** Matriz origem->destino entre áreas vizinhas, em pessoas/dia (estimativa). */
export function matrizOD(iso: string): { de: string; para: string; valor: number }[] {
  const entradasTotal = entradasDia(iso);
  const visitas: Record<string, number> = {};
  const fluxos: Record<string, number> = {};
  // Propaga as entradas pelo grafo (3 níveis de profundidade bastam pra demonstração)
  for (const e of ENTRADAS) {
    const fila: { caminho: string[]; qtd: number }[] = [{ caminho: [e.id], qtd: entradasTotal * e.peso }];
    while (fila.length) {
      const { caminho, qtd } = fila.shift()!;
      const atual = caminho[caminho.length - 1];
      visitas[atual] = (visitas[atual] ?? 0) + qtd;
      if (caminho.length > 6 || qtd < 5) continue;
      for (const t of transicoes(atual, caminho[caminho.length - 2])) {
        const chave = `${atual}>${t.para}`;
        fluxos[chave] = (fluxos[chave] ?? 0) + qtd * t.p;
        fila.push({ caminho: [...caminho, t.para], qtd: qtd * t.p });
      }
    }
  }
  return Object.entries(fluxos)
    .map(([k, v]) => {
      const [de, para] = k.split('>');
      return { de, para, valor: Math.round(v * (0.95 + 0.1 * hash(k + iso))) };
    })
    .sort((a, b) => b.valor - a.valor);
}

/** "De onde vêm as pessoas" que passam por uma zona (estimativa estatística). */
export function origemDoFluxo(zonaId: string): { origem: string; pct: number }[] {
  const z = ZONAS.find((x) => x.id === zonaId)!;
  const [zx, zy] = centro(z.rect);
  const candidatas = AREAS.filter((a) => a.id !== z.areaId);
  const pesos = candidatas.map((a) => {
    const [ax, ay] = centroArea(a.id);
    const dist = Math.hypot(ax - zx, ay - zy) + (a.andar !== z.andar ? 250 : 0);
    const base = a.tipo === 'entrada' ? (ENTRADAS.find((e) => e.id === a.id)?.peso ?? 0.1) * 6 : pesoArea(a.id) * 0.4;
    return base / (1 + dist / 180);
  });
  const soma = pesos.reduce((a, b) => a + b, 0);
  const lista = candidatas.map((a, i) => ({ origem: a.nome, pct: (100 * pesos[i]) / soma })).sort((a, b) => b.pct - a.pct);
  const top = lista.slice(0, 5);
  const outros = lista.slice(5).reduce((s, l) => s + l.pct, 0);
  return [...top, { origem: 'Outras áreas', pct: outros }].map((l) => ({ ...l, pct: Math.round(l.pct * 10) / 10 }));
}

/** Qualidade dos portais: saídas de um portal x chegadas no vizinho. */
export function qualidadePortais(iso: string): { de: string; para: string; saidas: number; chegadas: number; divergenciaPct: number }[] {
  return matrizOD(iso)
    .slice(0, 10)
    .map((f) => {
      const desvio = f.de === 'T-sul' && f.para === 'T-praca' ? 0.21 : (hash(f.de + f.para) - 0.5) * 0.1;
      const chegadas = Math.round(f.valor * (1 - desvio));
      return { de: f.de, para: f.para, saidas: f.valor, chegadas, divergenciaPct: Math.round(Math.abs(desvio) * 1000) / 10 };
    });
}

/** Antes x depois de uma ação: mesmas N semanas antes e depois, alinhadas por dia da semana. */
export function antesDepois(acao: AcaoZona, semanas = 4): { antes: number; depois: number; indiceAntes: number; indiceDepois: number; diasDepois: number } {
  const z = ZONAS.find((x) => x.id === acao.zonaId)!;
  const hoje = agoraDemo().data;
  const fimDepois = somarDias(acao.data, semanas * 7 - 1) > hoje ? somarDias(hoje, -1) : somarDias(acao.data, semanas * 7 - 1);
  const diasDepois = diasEntre(acao.data, fimDepois).length;
  const iniAntes = somarDias(acao.data, -diasDepois);
  const fimAntes = somarDias(acao.data, -1);
  const media = (ini: string, fim: string) => diasEntre(ini, fim).reduce((t, d) => t + fluxoZonaDia(z, d), 0) / Math.max(1, diasEntre(ini, fim).length);
  const mediaAndar = (ini: string, fim: string) => {
    const zs = ZONAS.filter((o) => o.andar === z.andar && o.areaId !== 'P1-alim');
    return zs.reduce((t, o) => t + diasEntre(ini, fim).reduce((u, d) => u + fluxoZonaDia(o, d), 0), 0) / zs.length / Math.max(1, diasEntre(ini, fim).length);
  };
  const antes = media(iniAntes, fimAntes);
  const depois = media(acao.data, fimDepois);
  return { antes, depois, indiceAntes: antes / mediaAndar(iniAntes, fimAntes), indiceDepois: depois / mediaAndar(acao.data, fimDepois), diasDepois };
}
