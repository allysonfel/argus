// Calendário de datas comerciais com as datas móveis calculadas (não
// fixas por ano): Carnaval e Páscoa pelo cálculo da Páscoa, Dia das
// Mães/Pais pelo 2º domingo, Black Friday pela 4ª quinta de novembro.

export type DataComercial = { id: string; nome: string; data: string; diasAntes: number; diasDepois: number };

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(ano, mes, dia);
}

function enesimoDiaSemana(ano: number, mes: number, diaSemana: number, n: number): Date {
  const primeiro = utc(ano, mes, 1);
  const desloc = (diaSemana - primeiro.getUTCDay() + 7) % 7;
  return utc(ano, mes, 1 + desloc + (n - 1) * 7);
}

function somarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

export function datasComerciais(ano: number): DataComercial[] {
  const p = pascoa(ano);
  return [
    { id: 'carnaval', nome: 'Carnaval', data: iso(somarDias(p, -47)), diasAntes: 3, diasDepois: 1 },
    { id: 'pascoa', nome: 'Páscoa', data: iso(p), diasAntes: 7, diasDepois: 0 },
    { id: 'maes', nome: 'Dia das Mães', data: iso(enesimoDiaSemana(ano, 5, 0, 2)), diasAntes: 10, diasDepois: 0 },
    { id: 'namorados', nome: 'Dia dos Namorados', data: iso(utc(ano, 6, 12)), diasAntes: 7, diasDepois: 0 },
    { id: 'saojoao', nome: 'São João', data: iso(utc(ano, 6, 24)), diasAntes: 10, diasDepois: 5 },
    { id: 'pais', nome: 'Dia dos Pais', data: iso(enesimoDiaSemana(ano, 8, 0, 2)), diasAntes: 10, diasDepois: 0 },
    { id: 'criancas', nome: 'Dia das Crianças', data: iso(utc(ano, 10, 12)), diasAntes: 10, diasDepois: 0 },
    { id: 'blackfriday', nome: 'Black Friday', data: iso(somarDias(enesimoDiaSemana(ano, 11, 4, 4), 1)), diasAntes: 2, diasDepois: 3 },
    { id: 'natal', nome: 'Natal', data: iso(utc(ano, 12, 25)), diasAntes: 20, diasDepois: 0 },
  ];
}

/** Janela [início, fim] (ISO) de uma data comercial. */
export function janela(dc: DataComercial): [string, string] {
  const d = new Date(dc.data + 'T00:00:00Z');
  return [iso(somarDias(d, -dc.diasAntes)), iso(somarDias(d, dc.diasDepois))];
}
