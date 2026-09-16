import { sql } from './db';
import { listarRegistrosPeriodo } from './ponto';
import type { AjustePonto, Colaborador, TipoMarcacao } from './tipos';
import { SEQUENCIA_MARCACOES } from './ponto';

export type MarcacaoEfetiva = {
  tipo: TipoMarcacao;
  horario: Date;
  origem: 'registro' | 'ajuste';
  ajusteId?: number;
};

export type DiaPonto = {
  data: string; // yyyy-mm-dd
  marcacoes: MarcacaoEfetiva[];
  minutosTrabalhados: number;
  minutosEsperados: number;
  divergenciaMinutos: number; // positivo = fez a mais, negativo = fez a menos
};

export type ResumoBancoHoras = {
  dias: DiaPonto[];
  minutosTrabalhadosTotal: number;
  minutosEsperadosTotal: number;
  minutosExtrasTotal: number; // divergência positiva somada
  minutosNegativosTotal: number; // |divergência negativa| somada
  percentualHoraExtra: number;
  saldoFinalMinutos: number; // extras*(1+percentual/100) - negativos
};

/** Busca ajustes APROVADOS de um colaborador no período — só esses entram
 * no cálculo de banco de horas (pendente/rejeitado não afeta o saldo). */
async function listarAjustesAprovados(empresaId: number, colaboradorId: number, inicio: string, fim: string): Promise<AjustePonto[]> {
  return sql<AjustePonto[]>`
    SELECT * FROM ajustes_ponto
    WHERE empresa_id = ${empresaId} AND colaborador_id = ${colaboradorId} AND status = 'aprovado'
      AND horario_ajustado::date >= ${inicio}::date AND horario_ajustado::date <= ${fim}::date
  `;
}

function minutosEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function chaveDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Monta o dia efetivo de marcações: registros originais (imutáveis) +
 * ajustes aprovados sobrepostos. `correcao` substitui a marcação do
 * mesmo tipo naquele dia; `inclusao` adiciona uma marcação que não
 * existia; `exclusao_justificada` remove uma marcação do cálculo (ex:
 * marcação duplicada por engano) sem apagar o registro original.
 */
export async function montarDiasPonto(colaborador: Colaborador, inicio: string, fim: string): Promise<DiaPonto[]> {
  const [registros, ajustes] = await Promise.all([
    listarRegistrosPeriodo(colaborador.empresa_id, colaborador.id, inicio, fim),
    listarAjustesAprovados(colaborador.empresa_id, colaborador.id, inicio, fim),
  ]);

  const porDia = new Map<string, MarcacaoEfetiva[]>();

  for (const r of registros) {
    const horario = new Date(r.registrado_em);
    const dia = chaveDia(horario);
    const excluido = ajustes.some((a) => a.tipo_ajuste === 'exclusao_justificada' && a.registro_ponto_id === r.id);
    if (excluido) continue;

    const correcao = ajustes.find((a) => a.tipo_ajuste === 'correcao' && a.registro_ponto_id === r.id);
    const efetivo: MarcacaoEfetiva = correcao
      ? { tipo: r.tipo, horario: new Date(correcao.horario_ajustado), origem: 'ajuste', ajusteId: correcao.id }
      : { tipo: r.tipo, horario, origem: 'registro' };

    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push(efetivo);
  }

  for (const a of ajustes) {
    if (a.tipo_ajuste !== 'inclusao') continue;
    const horario = new Date(a.horario_ajustado);
    const dia = chaveDia(horario);
    const tipo = a.tipo_marcacao ?? SEQUENCIA_MARCACOES[0];
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push({ tipo, horario, origem: 'ajuste', ajusteId: a.id });
  }

  // Expectativa diária = intervalo entre horário de entrada e saída
  // padrão do colaborador (simplificação de MVP — não considera almoço
  // configurável nem jornada por dia da semana, ver DECISIONS.md).
  const [hEntrada, mEntrada] = colaborador.horario_entrada_padrao.split(':').map(Number);
  const [hSaida, mSaida] = colaborador.horario_saida_padrao.split(':').map(Number);
  const minutosEsperados = Math.max(0, hSaida * 60 + mSaida - (hEntrada * 60 + mEntrada));

  const dias: DiaPonto[] = [];
  let cursor = new Date(inicio + 'T00:00:00Z');
  const limite = new Date(fim + 'T00:00:00Z');
  while (cursor <= limite) {
    const chave = chaveDia(cursor);
    const marcacoes = (porDia.get(chave) ?? []).sort((a, b) => a.horario.getTime() - b.horario.getTime());

    let minutosTrabalhados = 0;
    for (let i = 0; i + 1 < marcacoes.length; i += 2) {
      minutosTrabalhados += minutosEntre(marcacoes[i].horario, marcacoes[i + 1].horario);
    }

    const diaSemana = cursor.getUTCDay(); // 0 = domingo, 6 = sábado
    const ehDiaUtil = diaSemana !== 0 && diaSemana !== 6;

    dias.push({
      data: chave,
      marcacoes,
      minutosTrabalhados,
      minutosEsperados: ehDiaUtil ? minutosEsperados : 0,
      divergenciaMinutos: minutosTrabalhados - (ehDiaUtil ? minutosEsperados : 0),
    });

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return dias;
}

export async function calcularBancoHoras(colaborador: Colaborador, inicio: string, fim: string, percentualHoraExtra: number): Promise<ResumoBancoHoras> {
  const dias = await montarDiasPonto(colaborador, inicio, fim);

  let minutosTrabalhadosTotal = 0;
  let minutosEsperadosTotal = 0;
  let minutosExtrasTotal = 0;
  let minutosNegativosTotal = 0;

  for (const dia of dias) {
    minutosTrabalhadosTotal += dia.minutosTrabalhados;
    minutosEsperadosTotal += dia.minutosEsperados;
    if (dia.divergenciaMinutos > 0) minutosExtrasTotal += dia.divergenciaMinutos;
    else minutosNegativosTotal += Math.abs(dia.divergenciaMinutos);
  }

  const saldoFinalMinutos = Math.round(minutosExtrasTotal * (1 + percentualHoraExtra / 100)) - minutosNegativosTotal;

  return {
    dias,
    minutosTrabalhadosTotal,
    minutosEsperadosTotal,
    minutosExtrasTotal,
    minutosNegativosTotal,
    percentualHoraExtra,
    saldoFinalMinutos,
  };
}

export function formatarMinutos(minutos: number): string {
  const sinal = minutos < 0 ? '-' : '';
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${h}h${String(m).padStart(2, '0')}`;
}
