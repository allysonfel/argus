import { sql } from './db';
import { obterCriterios } from './configuracoes';
import { analisarCheckin } from './analiseIa';
import type { RegistroPonto, TipoMarcacao } from './tipos';

export const SEQUENCIA_MARCACOES: TipoMarcacao[] = ['ENTRADA_1', 'SAIDA_1', 'ENTRADA_2', 'SAIDA_2', 'ENTRADA_3', 'SAIDA_3'];

export function rotuloMarcacao(tipo: TipoMarcacao): string {
  const rotulos: Record<TipoMarcacao, string> = {
    ENTRADA_1: 'Entrada 1',
    SAIDA_1: 'Saída 1',
    ENTRADA_2: 'Entrada 2',
    SAIDA_2: 'Saída 2',
    ENTRADA_3: 'Entrada 3',
    SAIDA_3: 'Saída 3',
  };
  return rotulos[tipo];
}

/** Próxima marcação esperada hoje, dado quantas já foram feitas — cicla
 * pela sequência fixa (entrada/saída alternando). */
export async function proximaMarcacao(empresaId: number, colaboradorId: number): Promise<TipoMarcacao> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*) FROM registros_ponto
    WHERE empresa_id = ${empresaId} AND colaborador_id = ${colaboradorId} AND registrado_em::date = current_date
  `;
  const feitas = Number(rows[0].count);
  return SEQUENCIA_MARCACOES[feitas % SEQUENCIA_MARCACOES.length];
}

/**
 * Registra o ponto — SEMPRE grava (registro imutável), mesmo se a
 * análise de IA reprovar. A reprovação vira só um sinalizador visível
 * pra gestão (ver analise_ia), nunca bloqueia a marcação em si —
 * requisito explícito da especificação.
 */
export async function registrarPonto(params: {
  empresaId: number;
  colaboradorId: number;
  fotoDataUrl: string;
  latitude: number | null;
  longitude: number | null;
  enderecoAprox: string | null;
}): Promise<RegistroPonto> {
  const tipo = await proximaMarcacao(params.empresaId, params.colaboradorId);
  const criterios = await obterCriterios(params.empresaId);
  const analise = await analisarCheckin({ fotoDataUrl: params.fotoDataUrl, colaboradorId: params.colaboradorId, criterios });

  // A selfie em si não é persistida nesta fase (não há storage de objeto
  // configurado — ver DECISIONS.md); só o resultado da análise fica
  // registrado. foto_url existe no schema pra quando isso for plugado
  // (ex: S3, mesmo padrão do outro produto Logos).
  const rows = await sql<RegistroPonto[]>`
    INSERT INTO registros_ponto (empresa_id, colaborador_id, tipo, foto_url, latitude, longitude, endereco_aprox, analise_ia)
    VALUES (${params.empresaId}, ${params.colaboradorId}, ${tipo}, ${null},
            ${params.latitude}, ${params.longitude}, ${params.enderecoAprox}, ${sql.json(analise)})
    RETURNING *
  `;
  return rows[0];
}

/** Registros de um colaborador num período (pro Cartão Ponto), mais
 * antigo primeiro. */
export async function listarRegistrosPeriodo(empresaId: number, colaboradorId: number, inicio: string, fim: string): Promise<RegistroPonto[]> {
  return sql<RegistroPonto[]>`
    SELECT * FROM registros_ponto
    WHERE empresa_id = ${empresaId} AND colaborador_id = ${colaboradorId}
      AND registrado_em::date >= ${inicio}::date AND registrado_em::date <= ${fim}::date
    ORDER BY registrado_em
  `;
}

/** Todas as marcações de HOJE da empresa inteira, com nome/unidade do
 * colaborador — usado pelo Mapa do Ponto e pela lista "Atrasos do Dia". */
export async function listarRegistrosDoDia(empresaId: number, data: string) {
  return sql<(RegistroPonto & { colaborador_nome: string; unidade_nome: string | null })[]>`
    SELECT r.*, c.nome AS colaborador_nome, u.nome AS unidade_nome
    FROM registros_ponto r
    JOIN colaboradores c ON c.id = r.colaborador_id
    LEFT JOIN unidades u ON u.id = c.unidade_id
    WHERE r.empresa_id = ${empresaId} AND r.registrado_em::date = ${data}::date
    ORDER BY r.registrado_em DESC
  `;
}

/** Igual acima, mas por intervalo — usado pelo filtro de datas do Mapa do Ponto. */
export async function listarRegistrosIntervalo(empresaId: number, inicio: string, fim: string, busca?: string) {
  const termo = busca?.trim();
  return sql<(RegistroPonto & { colaborador_nome: string })[]>`
    SELECT r.*, c.nome AS colaborador_nome
    FROM registros_ponto r
    JOIN colaboradores c ON c.id = r.colaborador_id
    WHERE r.empresa_id = ${empresaId}
      AND r.registrado_em::date >= ${inicio}::date AND r.registrado_em::date <= ${fim}::date
      AND r.latitude IS NOT NULL
      ${termo ? sql`AND c.nome ILIKE ${'%' + termo + '%'}` : sql``}
    ORDER BY r.registrado_em DESC
  `;
}

export async function contarRegistrosIntervalo(empresaId: number, inicio: string, fim: string): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*) FROM registros_ponto
    WHERE empresa_id = ${empresaId} AND registrado_em::date >= ${inicio}::date AND registrado_em::date <= ${fim}::date
  `;
  return Number(rows[0].count);
}

export async function contarPresentesHoje(empresaId: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(DISTINCT colaborador_id) FROM registros_ponto
    WHERE empresa_id = ${empresaId} AND registrado_em::date = current_date
  `;
  return Number(rows[0].count);
}
