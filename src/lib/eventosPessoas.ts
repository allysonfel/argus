import { sql } from './db';
import type { EventoPessoa } from './tipos';

/** Eventos programados nos próximos N dias — "Pessoas em movimento" no
 * dashboard (férias/afastamento que vão começar ou voltar em breve). */
export async function listarProximosEventos(empresaId: number, diasJanela: number) {
  return sql<(EventoPessoa & { colaborador_nome: string })[]>`
    SELECT e.*, c.nome AS colaborador_nome
    FROM eventos_pessoas e
    JOIN colaboradores c ON c.id = e.colaborador_id
    WHERE e.empresa_id = ${empresaId}
      AND e.status IN ('aprovado', 'em_andamento')
      AND (
        (e.data_inicio >= current_date AND e.data_inicio <= current_date + ${diasJanela}::int)
        OR (e.data_fim IS NOT NULL AND e.data_fim >= current_date AND e.data_fim <= current_date + ${diasJanela}::int)
      )
    ORDER BY e.data_inicio
  `;
}

export async function listarSolicitacoesPendentes(empresaId: number) {
  return sql<(EventoPessoa & { colaborador_nome: string })[]>`
    SELECT e.*, c.nome AS colaborador_nome
    FROM eventos_pessoas e
    JOIN colaboradores c ON c.id = e.colaborador_id
    WHERE e.empresa_id = ${empresaId} AND e.status = 'solicitado'
    ORDER BY e.criado_em
  `;
}

export async function contarSolicitacoesPendentes(empresaId: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`SELECT count(*) FROM eventos_pessoas WHERE empresa_id = ${empresaId} AND status = 'solicitado'`;
  return Number(rows[0].count);
}

export async function decidirSolicitacao(empresaId: number, eventoId: number, decisao: 'aprovado' | 'rejeitado'): Promise<void> {
  await sql`
    UPDATE eventos_pessoas SET status = ${decisao}
    WHERE empresa_id = ${empresaId} AND id = ${eventoId} AND status = 'solicitado'
  `;
}

/** Admissões em andamento — onboarding: colaborador admitido nos
 * últimos N dias (proxy simples de "processo de admissão em curso",
 * já que não há módulo de onboarding formal nesta fase — ver DECISIONS.md). */
export async function contarAdmissoesEmAndamento(empresaId: number, diasJanela: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*) FROM colaboradores
    WHERE empresa_id = ${empresaId} AND data_admissao >= current_date - ${diasJanela}::int
  `;
  return Number(rows[0].count);
}
