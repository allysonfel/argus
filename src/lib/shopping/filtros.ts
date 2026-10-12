import { agoraDemo, somarDias } from './demo';

export type Busca = Record<string, string | string[] | undefined>;

export function um(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function varios(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** Período a partir de ?periodo=7|30|90 ou ?de=&ate= (padrão: 30 dias). */
export function periodoDaBusca(sp: Busca, padraoDias = 30): { inicio: string; fim: string; dias: number; rotulo: string } {
  const hoje = agoraDemo().data;
  const de = um(sp.de);
  const ate = um(sp.ate);
  if (de && ate && de <= ate) {
    const fim = ate > hoje ? hoje : ate;
    const dias = Math.round((new Date(fim).getTime() - new Date(de).getTime()) / 86400000) + 1;
    return { inicio: de, fim, dias, rotulo: 'personalizado' };
  }
  const dias = Number(um(sp.periodo)) || padraoDias;
  return { inicio: somarDias(hoje, -(dias - 1)), fim: hoje, dias, rotulo: `${dias}` };
}
