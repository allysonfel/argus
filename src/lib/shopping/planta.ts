// Planta de DEMONSTRAÇÃO do Shopping Caruaru (2 pisos). Geometria
// simplificada em coordenadas SVG (viewBox 1000 x 560 por piso), só pra
// telas de demonstração — será substituída pela planta baixa real
// enviada pela administração (upload por andar + calibração).
//
// Regra do cliente: só câmeras de CORREDOR. "Zona" é sempre uma área de
// corredor; a "frente de loja" é a metade do corredor encostada na loja.

export type Andar = 'T' | 'P1';
export type Retangulo = { x: number; y: number; w: number; h: number };

export type Area = { id: string; nome: string; andar: Andar; tipo: 'entrada' | 'corredor' | 'praca' | 'alimentacao' | 'escada' };
export type Zona = { id: string; nome: string; andar: Andar; areaId: string; corredor: string; rect: Retangulo; peso: number; permanenciaBaseS: number };
export type Loja = { id: string; nome: string; categoria: string; andar: Andar; rect: Retangulo; frenteZonaId: string; portaVisivel: boolean; plano: 'Básico' | 'Completo' | null };
export type Entrada = { id: string; nome: string; andar: Andar; rect: Retangulo; peso: number; zonaId: string };
export type Camera = { id: string; nome: string; andar: Andar; x: number; y: number; zonas: string[] };

export const ANDARES: { id: Andar; nome: string }[] = [
  { id: 'T', nome: 'Térreo' },
  { id: 'P1', nome: 'Piso 1' },
];

export const AREAS: Area[] = [
  { id: 'ent-principal', nome: 'Entrada Principal', andar: 'T', tipo: 'entrada' },
  { id: 'ent-estac', nome: 'Entrada Estacionamento', andar: 'T', tipo: 'entrada' },
  { id: 'ent-norte', nome: 'Entrada Norte', andar: 'T', tipo: 'entrada' },
  { id: 'ent-sul', nome: 'Entrada Sul (Ônibus)', andar: 'T', tipo: 'entrada' },
  { id: 'T-oeste', nome: 'Corredor Principal Oeste', andar: 'T', tipo: 'corredor' },
  { id: 'T-praca', nome: 'Praça Central', andar: 'T', tipo: 'praca' },
  { id: 'T-leste', nome: 'Corredor Principal Leste', andar: 'T', tipo: 'corredor' },
  { id: 'T-norte', nome: 'Ala Norte', andar: 'T', tipo: 'corredor' },
  { id: 'T-sul', nome: 'Ala Sul', andar: 'T', tipo: 'corredor' },
  { id: 'escadas', nome: 'Escadas rolantes', andar: 'T', tipo: 'escada' },
  { id: 'P1-oeste', nome: 'Piso 1 · Corredor Oeste', andar: 'P1', tipo: 'corredor' },
  { id: 'P1-praca', nome: 'Piso 1 · Mezanino', andar: 'P1', tipo: 'praca' },
  { id: 'P1-leste', nome: 'Piso 1 · Corredor Leste', andar: 'P1', tipo: 'corredor' },
  { id: 'P1-alim', nome: 'Praça de Alimentação', andar: 'P1', tipo: 'alimentacao' },
  { id: 'P1-sul', nome: 'Piso 1 · Ala Cinema', andar: 'P1', tipo: 'corredor' },
];

// Corredor principal: 9 células de 93,3 px entre x=80 e x=920 (y 240-320).
// A célula do meio (4) é a praça central, onde chegam os corredores verticais.
const X0 = 80;
const CEL = (920 - 80) / 9;
const CATEGORIAS = ['Moda feminina', 'Calçados', 'Eletrônicos', 'Óticas', 'Perfumaria', 'Moda masculina', 'Esportes', 'Joalheria', 'Brinquedos', 'Livraria', 'Casa & decoração', 'Moda infantil', 'Acessórios', 'Farmácia', 'Telefonia', 'Cafeteria'];

// Peso (atratividade) de cada célula do corredor principal, por andar.
// Valores baixos de propósito em alguns pontos, pra existir "zona morta".
const PESOS: Record<Andar, number[]> = {
  T: [1.0, 0.9, 0.85, 0.95, 1.3, 1.0, 0.8, 0.7, 0.95],
  P1: [0.55, 0.5, 0.6, 0.75, 1.0, 0.8, 0.65, 0.18, 0.15],
};

function construir() {
  const zonas: Zona[] = [];
  const lojas: Loja[] = [];
  let nLoja = 0;

  function novaLoja(andar: Andar, rect: Retangulo, frenteZonaId: string) {
    nLoja++;
    const num = String(nLoja).padStart(2, '0');
    const categoria = CATEGORIAS[(nLoja * 7) % CATEGORIAS.length];
    lojas.push({
      id: `L${andar}${num}`,
      nome: `Loja ${andar === 'T' ? '1' : '2'}${num}`,
      categoria,
      andar,
      rect,
      frenteZonaId,
      portaVisivel: nLoja % 3 !== 0,
      plano: nLoja % 4 === 0 ? null : nLoja % 3 === 0 ? 'Básico' : 'Completo',
    });
  }

  for (const andar of ['T', 'P1'] as Andar[]) {
    const pref = andar === 'T' ? 'T' : 'P1';
    for (let i = 0; i < 9; i++) {
      const x = X0 + i * CEL;
      const areaId = i < 4 ? `${pref}-oeste` : i === 4 ? `${pref}-praca` : `${pref}-leste`;
      const corredor = i < 4 ? 'Corredor Principal Oeste' : i === 4 ? 'Praça Central' : 'Corredor Principal Leste';
      const nomeCorredor = andar === 'T' ? corredor : `Piso 1 · ${corredor.replace('Corredor Principal ', 'Corredor ')}`;
      if (i === 4) {
        zonas.push({ id: `${pref}-C4`, nome: andar === 'T' ? 'Praça Central' : 'Mezanino', andar, areaId, corredor: nomeCorredor, rect: { x, y: 240, w: CEL, h: 80 }, peso: PESOS[andar][i], permanenciaBaseS: 75 });
        continue;
      }
      const peso = PESOS[andar][i];
      const zN = `${pref}-C${i}-n`;
      const zS = `${pref}-C${i}-s`;
      zonas.push({ id: zN, nome: `${nomeCorredor} · trecho ${i + 1} (lado norte)`, andar, areaId, corredor: nomeCorredor, rect: { x, y: 240, w: CEL, h: 40 }, peso: peso * 1.05, permanenciaBaseS: 35 });
      zonas.push({ id: zS, nome: `${nomeCorredor} · trecho ${i + 1} (lado sul)`, andar, areaId, corredor: nomeCorredor, rect: { x, y: 280, w: CEL, h: 40 }, peso: peso * 0.95, permanenciaBaseS: 35 });
      novaLoja(andar, { x: x + 3, y: 150, w: CEL - 6, h: 87 }, zN);
      novaLoja(andar, { x: x + 3, y: 323, w: CEL - 6, h: 87 }, zS);
    }

    const xv = X0 + 4 * CEL;
    if (andar === 'T') {
      // Ala Norte e Ala Sul (corredores verticais com lojas dos dois lados)
      for (const [ala, ys, areaId, nomeAla, peso] of [
        ['N', [60, 150], 'T-norte', 'Ala Norte', 0.9],
        ['S', [410, 320], 'T-sul', 'Ala Sul', 0.6],
      ] as const) {
        ys.forEach((y, k) => {
          const h = 90;
          const idBase = `T-${ala}${k}`;
          zonas.push({ id: `${idBase}-o`, nome: `${nomeAla} · trecho ${k + 1} (lado oeste)`, andar, areaId, corredor: nomeAla, rect: { x: xv, y, w: CEL / 2, h }, peso: peso * (k === 0 ? 1 : 1.1), permanenciaBaseS: 30 });
          zonas.push({ id: `${idBase}-l`, nome: `${nomeAla} · trecho ${k + 1} (lado leste)`, andar, areaId, corredor: nomeAla, rect: { x: xv + CEL / 2, y, w: CEL / 2, h }, peso: peso * (k === 0 ? 0.9 : 1.05), permanenciaBaseS: 30 });
          if ((ala === 'N' && k === 0) || (ala === 'S' && k === 0)) {
            novaLoja(andar, { x: xv - CEL + 3, y: y + 3, w: CEL - 6, h: h - 6 }, `${idBase}-o`);
            novaLoja(andar, { x: xv + CEL + 3, y: y + 3, w: CEL - 6, h: h - 6 }, `${idBase}-l`);
          }
        });
      }
    } else {
      zonas.push({ id: 'P1-ALIM', nome: 'Praça de Alimentação', andar, areaId: 'P1-alim', corredor: 'Praça de Alimentação', rect: { x: 300, y: 30, w: 400, h: 117 }, peso: 2.4, permanenciaBaseS: 1500 });
      zonas.push({ id: 'P1-N0', nome: 'Acesso à Praça de Alimentação', andar, areaId: 'P1-alim', corredor: 'Praça de Alimentação', rect: { x: xv, y: 150, w: CEL, h: 90 }, peso: 1.3, permanenciaBaseS: 25 });
      zonas.push({ id: 'P1-S0', nome: 'Ala Cinema · acesso', andar, areaId: 'P1-sul', corredor: 'Ala Cinema', rect: { x: xv, y: 320, w: CEL, h: 90 }, peso: 0.7, permanenciaBaseS: 40 });
      zonas.push({ id: 'P1-S1', nome: 'Ala Cinema · bilheteria', andar, areaId: 'P1-sul', corredor: 'Ala Cinema', rect: { x: xv, y: 410, w: CEL, h: 90 }, peso: 0.6, permanenciaBaseS: 120 });
    }
  }
  return { zonas, lojas };
}

const construido = construir();
export const ZONAS: Zona[] = construido.zonas;
export const LOJAS: Loja[] = construido.lojas;

export const ENTRADAS: Entrada[] = [
  { id: 'ent-principal', nome: 'Entrada Principal', andar: 'T', rect: { x: 20, y: 240, w: 60, h: 80 }, peso: 0.38, zonaId: 'T-C0-n' },
  { id: 'ent-estac', nome: 'Entrada Estacionamento', andar: 'T', rect: { x: 920, y: 240, w: 60, h: 80 }, peso: 0.32, zonaId: 'T-C8-n' },
  { id: 'ent-norte', nome: 'Entrada Norte', andar: 'T', rect: { x: X0 + 4 * CEL, y: 20, w: CEL, h: 40 }, peso: 0.18, zonaId: 'T-N0-o' },
  { id: 'ent-sul', nome: 'Entrada Sul (Ônibus)', andar: 'T', rect: { x: X0 + 4 * CEL, y: 500, w: CEL, h: 40 }, peso: 0.12, zonaId: 'T-S0-o' },
];

export const ESCADAS: { andar: Andar; rect: Retangulo }[] = [
  { andar: 'T', rect: { x: X0 + 4 * CEL + 14, y: 262, w: CEL - 28, h: 36 } },
  { andar: 'P1', rect: { x: X0 + 4 * CEL + 14, y: 262, w: CEL - 28, h: 36 } },
];

export const CINEMA: Retangulo = { x: X0 + 3 * CEL + 3, y: 413, w: CEL * 3 - 6, h: 100 };


// Câmeras de corredor (demonstração): uma por par de zonas, aproximadamente.
function construirCameras(): Camera[] {
  const cams: Camera[] = [];
  for (const andar of ['T', 'P1'] as Andar[]) {
    const zs = ZONAS.filter((z) => z.andar === andar);
    const grupos: Zona[][] = [];
    const vistos = new Set<string>();
    for (const z of zs) {
      if (vistos.has(z.id)) continue;
      const par = zs.find((o) => !vistos.has(o.id) && o.id !== z.id && o.id.replace(/-(n|s|o|l)$/, '') === z.id.replace(/-(n|s|o|l)$/, ''));
      const grupo = par ? [z, par] : [z];
      grupo.forEach((g) => vistos.add(g.id));
      grupos.push(grupo);
    }
    grupos.forEach((g, i) => {
      const r = g.reduce((acc, z) => ({ x: Math.min(acc.x, z.rect.x), y: Math.min(acc.y, z.rect.y), x2: Math.max(acc.x2, z.rect.x + z.rect.w), y2: Math.max(acc.y2, z.rect.y + z.rect.h) }), { x: 9999, y: 9999, x2: 0, y2: 0 });
      cams.push({ id: `CAM-${andar}-${String(i + 1).padStart(2, '0')}`, nome: `${g[0].corredor} · câm. ${i + 1}`, andar, x: (r.x + r.x2) / 2, y: (r.y + r.y2) / 2, zonas: g.map((z) => z.id) });
    });
  }
  return cams;
}
export const CAMERAS: Camera[] = construirCameras();

export const zonaPorId = (id: string) => ZONAS.find((z) => z.id === id);
export const lojaPorId = (id: string) => LOJAS.find((l) => l.id === id);
export const areaPorId = (id: string) => AREAS.find((a) => a.id === id);

export function centro(r: Retangulo): [number, number] {
  return [r.x + r.w / 2, r.y + r.h / 2];
}

/** Centro aproximado de uma área de negócio (média das zonas/entrada). */
export function centroArea(areaId: string): [number, number] {
  const ent = ENTRADAS.find((e) => e.id === areaId);
  if (ent) return centro(ent.rect);
  if (areaId === 'escadas') return centro(ESCADAS[0].rect);
  const zs = ZONAS.filter((z) => z.areaId === areaId);
  const cs = zs.map((z) => centro(z.rect));
  return [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length];
}
