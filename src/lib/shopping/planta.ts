// Planta do Caruaru Shopping (2 pisos), sobre as plantas oficiais:
//   Térreo: mapa do shopping (caruarushopping.com, 2021) -> public/plantas/terreo.jpg
//   Piso 1: planta comercial 2025 -> public/plantas/piso1.jpg
// As imagens ficam de fundo; por cima ficam as áreas por onde as pessoas
// ANDAM (corredores, praças, entradas), que é o que as câmeras de corredor
// medem. Coordenadas no espaço 1000 x 560 de cada piso; as funções T() e
// P() convertem do pixel da imagem original.
//
// Regra do cliente: só câmeras de CORREDOR. "Zona" é sempre uma área de
// circulação; as lojas aparecem só como destino (frente da loja).

export type Andar = 'T' | 'P1';
export type Retangulo = { x: number; y: number; w: number; h: number };

export type Area = { id: string; nome: string; andar: Andar; tipo: 'entrada' | 'corredor' | 'praca' | 'alimentacao' | 'escada' | 'estacionamento' };
export type Zona = { id: string; nome: string; andar: Andar; areaId: string; corredor: string; rect: Retangulo; peso: number; permanenciaBaseS: number };
// atracao: quanto a loja puxa visitantes (âncoras puxam mais).
export type Loja = { id: string; nome: string; categoria: string; andar: Andar; rect: Retangulo; frenteZonaId: string; portaVisivel: boolean; plano: 'Básico' | 'Completo' | null; atracao: number };
export type Entrada = { id: string; nome: string; andar: Andar; rect: Retangulo; peso: number; zonaId: string };
export type Camera = { id: string; nome: string; andar: Andar; x: number; y: number; zonas: string[] };

export const ANDARES: { id: Andar; nome: string }[] = [
  { id: 'T', nome: 'Térreo' },
  { id: 'P1', nome: 'Piso 1' },
];

// Imagem de fundo de cada piso, encaixada no 1000 x 560.
const ESC_T = 0.56; // terreo.jpg 1615 x 1000
const DX_T = 48;
const ESC_P = 560 / 690; // piso1.jpg 1200 x 690
const DX_P = 13;
export const FUNDO: Record<Andar, { src: string; x: number; y: number; w: number; h: number }> = {
  T: { src: '/plantas/terreo.jpg', x: DX_T, y: 0, w: 1615 * ESC_T, h: 1000 * ESC_T },
  P1: { src: '/plantas/piso1.jpg', x: DX_P, y: 0, w: 1200 * ESC_P, h: 690 * ESC_P },
};
const T = (x: number, y: number, w: number, h: number): Retangulo => ({ x: DX_T + x * ESC_T, y: y * ESC_T, w: w * ESC_T, h: h * ESC_T });
const P = (x: number, y: number, w: number, h: number): Retangulo => ({ x: DX_P + x * ESC_P, y: y * ESC_P, w: w * ESC_P, h: h * ESC_P });

export const AREAS: Area[] = [
  { id: 'ent-principal', nome: 'Entrada Principal', andar: 'T', tipo: 'entrada' },
  { id: 'ent-oeste', nome: 'Entrada Oeste (Smart Fit)', andar: 'T', tipo: 'entrada' },
  { id: 'ent-estac', nome: 'Entrada do Estacionamento', andar: 'T', tipo: 'entrada' },
  { id: 'ent-leste', nome: 'Entrada Leste (Riachuelo)', andar: 'T', tipo: 'entrada' },
  { id: 'ent-e50', nome: 'Estacionamento E-50 (Piso 1)', andar: 'P1', tipo: 'entrada' },
  { id: 'T-oeste', nome: 'Ala Oeste (BIG · Smart Fit)', andar: 'T', tipo: 'corredor' },
  { id: 'T-faca', nome: 'Corredor da Faca', andar: 'T', tipo: 'corredor' },
  { id: 'T-quiosque', nome: 'Praça do Quiosque (entrada principal)', andar: 'T', tipo: 'praca' },
  { id: 'T-sul', nome: 'Corredor Sul (Unimagem)', andar: 'T', tipo: 'corredor' },
  { id: 'T-praca', nome: 'Praça Central', andar: 'T', tipo: 'praca' },
  { id: 'T-marisa', nome: 'Corredor da Marisa', andar: 'T', tipo: 'corredor' },
  { id: 'T-ca', nome: 'Corredor da C&A', andar: 'T', tipo: 'corredor' },
  { id: 'T-alim', nome: 'Praça de Alimentação', andar: 'T', tipo: 'alimentacao' },
  { id: 'T-central', nome: 'Corredor Central (lojas 21 a 137)', andar: 'T', tipo: 'corredor' },
  { id: 'T-norte', nome: 'Corredor Norte (Caixa · Renner)', andar: 'T', tipo: 'corredor' },
  { id: 'T-leste', nome: 'Corredor Leste (Centerplex)', andar: 'T', tipo: 'corredor' },
  { id: 'escadas', nome: 'Escadas rolantes', andar: 'T', tipo: 'escada' },
  { id: 'P1-oeste', nome: 'Piso 1 · Praça da Escada Oeste', andar: 'P1', tipo: 'praca' },
  { id: 'P1-lojas', nome: 'Piso 1 · Corredor das Lojas 8001 a 8016', andar: 'P1', tipo: 'corredor' },
  { id: 'P1-centro', nome: 'Piso 1 · Acesso Anhanguera', andar: 'P1', tipo: 'corredor' },
  { id: 'P1-praca', nome: 'Piso 1 · Praça Redonda', andar: 'P1', tipo: 'praca' },
  { id: 'P1-conv', nome: 'Piso 1 · Corredor do Centro de Convenções', andar: 'P1', tipo: 'corredor' },
  { id: 'P1-estac', nome: 'Piso 1 · Acesso ao Estacionamento E-50', andar: 'P1', tipo: 'estacionamento' },
];

const nomeArea = (id: string) => AREAS.find((a) => a.id === id)!.nome;

// Zonas: [id, área, retângulo, atratividade (peso), permanência típica em s].
// Corredores em diagonal viram uma sequência de retângulos encostados.
const DEF_ZONAS: [string, string, Retangulo, number, number][] = [
  // Térreo
  ['T-O1', 'T-oeste', T(330, 455, 115, 65), 0.5, 30],
  ['T-O2', 'T-oeste', T(440, 440, 100, 85), 0.9, 35],
  ['T-F1', 'T-faca', T(500, 485, 65, 60), 0.85, 30],
  ['T-F2', 'T-faca', T(530, 530, 65, 60), 0.8, 30],
  ['T-F3', 'T-faca', T(560, 575, 60, 55), 0.85, 30],
  ['T-Q1', 'T-quiosque', T(575, 600, 80, 75), 1.3, 60],
  ['T-Q2', 'T-quiosque', T(540, 665, 70, 60), 1.1, 25],
  ['T-S1', 'T-sul', T(650, 628, 75, 55), 0.75, 30],
  ['T-S2', 'T-sul', T(720, 650, 100, 50), 0.8, 30],
  ['T-PC', 'T-praca', T(815, 645, 85, 85), 1.4, 70],
  ['T-M1', 'T-marisa', T(895, 665, 100, 45), 0.95, 35],
  ['T-M2', 'T-marisa', T(990, 665, 100, 45), 0.6, 35],
  ['T-C1', 'T-ca', T(640, 420, 80, 65), 1.0, 30],
  ['T-C2', 'T-ca', T(700, 460, 80, 65), 0.95, 30],
  ['T-C3', 'T-ca', T(760, 505, 75, 65), 0.9, 30],
  ['T-C4', 'T-ca', T(812, 555, 65, 65), 0.95, 30],
  ['T-C5', 'T-ca', T(835, 610, 50, 45), 1.0, 25],
  ['T-ALIM', 'T-alim', T(650, 340, 250, 130), 2.4, 1500],
  ['T-V1', 'T-central', T(843, 465, 40, 95), 0.7, 30],
  ['T-V2', 'T-central', T(843, 555, 40, 95), 0.55, 30],
  ['T-N1', 'T-norte', T(895, 415, 135, 40), 1.0, 35],
  ['T-N2', 'T-norte', T(1025, 415, 130, 40), 1.05, 35],
  ['T-N3', 'T-norte', T(1145, 425, 70, 60), 0.85, 30],
  ['T-L1', 'T-leste', T(1185, 480, 45, 110), 0.7, 40],
  ['T-L2', 'T-leste', T(1185, 585, 45, 110), 0.45, 40],
  // Piso 1
  ['P1-O1', 'P1-oeste', P(240, 300, 125, 100), 0.6, 40],
  ['P1-L1', 'P1-lojas', P(360, 362, 120, 40), 0.55, 35],
  ['P1-L2', 'P1-lojas', P(475, 362, 120, 40), 0.75, 35],
  ['P1-L3', 'P1-lojas', P(590, 362, 125, 40), 0.6, 35],
  ['P1-A1', 'P1-centro', P(490, 398, 60, 75), 0.9, 30],
  ['P1-R0', 'P1-praca', P(705, 330, 60, 55), 0.5, 30],
  ['P1-R1', 'P1-praca', P(755, 282, 80, 80), 0.65, 60],
  ['P1-C1', 'P1-conv', P(830, 258, 75, 50), 0.4, 30],
  ['P1-C2', 'P1-conv', P(895, 232, 75, 50), 0.3, 30],
  ['P1-C3', 'P1-conv', P(960, 207, 70, 50), 0.25, 30],
  ['P1-E0', 'P1-estac', P(690, 385, 105, 70), 0.35, 25],
];

export const ZONAS: Zona[] = DEF_ZONAS.map(([id, areaId, rect, peso, permanenciaBaseS], i, todas) => {
  const daArea = todas.filter((z) => z[1] === areaId);
  const n = daArea.findIndex((z) => z[0] === id) + 1;
  const nome = nomeArea(areaId);
  return { id, nome: daArea.length > 1 ? `${nome} · trecho ${n}` : nome, andar: id.startsWith('P1') ? 'P1' : 'T', areaId, corredor: nome, rect, peso, permanenciaBaseS };
});

/** Praça de alimentação (uso diferente: as pessoas ficam sentadas, fica fora das médias). */
export const AREA_ALIMENTACAO = 'T-alim';
export const ZONA_ALIMENTACAO = 'T-ALIM';

export const ENTRADAS: Entrada[] = [
  { id: 'ent-principal', nome: 'Entrada Principal', andar: 'T', rect: T(495, 715, 70, 45), peso: 0.36, zonaId: 'T-Q2' },
  { id: 'ent-oeste', nome: 'Entrada Oeste (Smart Fit)', andar: 'T', rect: T(280, 465, 55, 55), peso: 0.2, zonaId: 'T-O1' },
  { id: 'ent-estac', nome: 'Entrada do Estacionamento', andar: 'T', rect: T(735, 695, 70, 45), peso: 0.28, zonaId: 'T-S2' },
  { id: 'ent-leste', nome: 'Entrada Leste (Riachuelo)', andar: 'T', rect: T(1180, 690, 55, 45), peso: 0.12, zonaId: 'T-L2' },
  { id: 'ent-e50', nome: 'Estacionamento E-50', andar: 'P1', rect: P(795, 420, 110, 70), peso: 0.06, zonaId: 'P1-E0' },
];

// Escadas rolantes: [zona do Térreo, zona do Piso 1] + onde desenhar em cada piso.
export const LIGACOES_ESCADAS: [string, string][] = [
  ['T-Q1', 'P1-O1'],
  ['T-PC', 'P1-A1'],
  ['T-L1', 'P1-C3'],
];
export const ESCADAS: { andar: Andar; rect: Retangulo }[] = [
  { andar: 'T', rect: T(590, 625, 45, 22) },
  { andar: 'T', rect: T(835, 700, 45, 22) },
  { andar: 'T', rect: T(1190, 500, 35, 22) },
  { andar: 'P1', rect: P(270, 320, 55, 35) },
  { andar: 'P1', rect: P(505, 420, 30, 45) },
  { andar: 'P1', rect: P(930, 200, 60, 35) },
];

/** Centerplex (cinema), no Térreo; a porta é pelo Corredor Leste. */
export const CINEMA: Retangulo = T(1290, 450, 90, 220);
export const ZONA_CINEMA = 'T-L1';

// Lojas e âncoras como DESTINO das pessoas (a planta oficial já mostra os nomes).
const DEF_LOJAS: [string, string, Andar, Retangulo, string][] = [
  ['BIG Bompreço', 'Hipermercado', 'T', T(350, 30, 420, 330), 'T-O2'],
  ['Kalunga · Studio Z', 'Papelaria · Moda', 'T', T(270, 330, 170, 120), 'T-O1'],
  ['Smart Fit', 'Academia', 'T', T(360, 515, 90, 75), 'T-O1'],
  ['C&A', 'Moda', 'T', T(540, 280, 180, 140), 'T-C1'],
  ['Lojas Americanas', 'Variedades', 'T', T(690, 290, 250, 50), 'T-N1'],
  ['Caixa', 'Banco', 'T', T(950, 290, 90, 120), 'T-N1'],
  ['Renner', 'Moda', 'T', T(1050, 300, 230, 110), 'T-N2'],
  ['Atacadão dos Eletros · Império · Game Station · Nagem', 'Eletro e games', 'T', T(880, 460, 280, 110), 'T-N1'],
  ['Marisa', 'Moda', 'T', T(880, 560, 280, 100), 'T-M1'],
  ['Casas Bahia', 'Eletro', 'T', T(1100, 640, 90, 40), 'T-M2'],
  ['Riachuelo', 'Moda', 'T', T(1090, 680, 260, 90), 'T-L2'],
  ['Polishop · lojas 111 a 117', 'Variedades', 'T', T(1240, 470, 50, 160), 'T-L1'],
  ['Lojas 120 a 130', 'Variedades', 'T', T(1145, 480, 40, 190), 'T-L2'],
  ['Le Biscuit', 'Casa', 'T', T(900, 720, 180, 70), 'T-M2'],
  ['Unimagem', 'Saúde', 'T', T(650, 690, 100, 80), 'T-S1'],
  ['Faca · Tio Armênio', 'Alimentação', 'T', T(560, 640, 60, 60), 'T-Q2'],
  ['Lojas 05 a 12', 'Moda e acessórios', 'T', T(450, 520, 100, 100), 'T-F2'],
  ['Lojas 50 a 58', 'Moda e acessórios', 'T', T(600, 480, 150, 120), 'T-C3'],
  ['Hospital Intensiva Day', 'Saúde', 'P1', P(80, 180, 200, 200), 'P1-O1'],
  ['Expansão Coworking', 'Escritórios', 'P1', P(270, 270, 130, 80), 'P1-O1'],
  ['Lojas 8001 a 8016', 'Serviços', 'P1', P(400, 325, 260, 40), 'P1-L2'],
  ['Faculdade Anhanguera', 'Educação', 'P1', P(560, 400, 180, 120), 'P1-A1'],
  ['Hub Plural', 'Escritórios', 'P1', P(200, 390, 160, 150), 'P1-L1'],
  ['GO! Park', 'Lazer', 'P1', P(820, 300, 220, 120), 'P1-R1'],
  ['Centro de Convenções', 'Eventos', 'P1', P(750, 100, 300, 180), 'P1-C2'],
  ['Epic Tower', 'Escritórios', 'P1', P(620, 520, 170, 120), 'P1-A1'],
];
const ANCORAS = ['BIG Bompreço', 'C&A', 'Lojas Americanas', 'Renner', 'Marisa', 'Riachuelo', 'Atacadão dos Eletros · Império · Game Station · Nagem', 'Casas Bahia', 'Faculdade Anhanguera', 'Centro de Convenções', 'Smart Fit'];
export const LOJAS: Loja[] = DEF_LOJAS.map(([nome, categoria, andar, rect, frenteZonaId], i) => ({
  id: `L${andar}${String(i + 1).padStart(2, '0')}`,
  nome,
  categoria,
  andar,
  rect,
  frenteZonaId,
  portaVisivel: true,
  plano: null,
  atracao: ANCORAS.includes(nome) ? 3 : 1,
}));

// Ligações entre áreas (modelo de transições dos dados de demonstração).
export const LIGACOES_AREAS: [string, string][] = [
  ['ent-principal', 'T-quiosque'],
  ['ent-oeste', 'T-oeste'],
  ['ent-estac', 'T-sul'],
  ['ent-leste', 'T-leste'],
  ['T-oeste', 'T-faca'],
  ['T-faca', 'T-quiosque'],
  ['T-quiosque', 'T-sul'],
  ['T-sul', 'T-praca'],
  ['T-praca', 'T-marisa'],
  ['T-praca', 'T-ca'],
  ['T-praca', 'T-central'],
  ['T-ca', 'T-alim'],
  ['T-central', 'T-norte'],
  ['T-alim', 'T-norte'],
  ['T-norte', 'T-leste'],
  ['T-praca', 'escadas'],
  ['escadas', 'P1-centro'],
  ['P1-centro', 'P1-lojas'],
  ['P1-lojas', 'P1-oeste'],
  ['P1-lojas', 'P1-praca'],
  ['P1-praca', 'P1-conv'],
  ['P1-lojas', 'P1-estac'],
  ['P1-estac', 'ent-e50'],
];

// Câmeras de corredor (demonstração da tela de saúde): uma por par de zonas.
function construirCameras(): Camera[] {
  const cams: Camera[] = [];
  for (const andar of ['T', 'P1'] as Andar[]) {
    const zs = ZONAS.filter((z) => z.andar === andar);
    for (let i = 0; i < zs.length; i += 2) {
      const g = zs.slice(i, i + 2);
      const [cx, cy] = centro(g[0].rect);
      cams.push({ id: `CAM-${andar}-${String(cams.length + 1).padStart(2, '0')}`, nome: `${g[0].corredor} · câm. ${i / 2 + 1}`, andar, x: cx, y: cy, zonas: g.map((z) => z.id) });
    }
  }
  return cams;
}

export const zonaPorId = (id: string) => ZONAS.find((z) => z.id === id);
export const lojaPorId = (id: string) => LOJAS.find((l) => l.id === id);
export const areaPorId = (id: string) => AREAS.find((a) => a.id === id);

export function centro(r: Retangulo): [number, number] {
  return [r.x + r.w / 2, r.y + r.h / 2];
}

export const CAMERAS: Camera[] = construirCameras();

/** Centro aproximado de uma área (média das zonas/entrada). */
export function centroArea(areaId: string, andar?: Andar): [number, number] {
  const ent = ENTRADAS.find((e) => e.id === areaId);
  if (ent) return centro(ent.rect);
  if (areaId === 'escadas') return centro((ESCADAS.find((e) => e.andar === (andar ?? 'T')) ?? ESCADAS[0]).rect);
  const zs = ZONAS.filter((z) => z.areaId === areaId);
  const cs = zs.map((z) => centro(z.rect));
  return [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length];
}
