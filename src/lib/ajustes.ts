import { sql } from './db';
import type { AjustePonto, TipoMarcacao } from './tipos';

/** Cria uma solicitação de ajuste — nunca mexe em registros_ponto
 * diretamente (imutável); fica pendente até um admin aprovar/rejeitar. */
export async function solicitarAjuste(params: {
  empresaId: number;
  colaboradorId: number;
  registroPontoId: number | null;
  tipoAjuste: 'inclusao' | 'correcao' | 'exclusao_justificada';
  tipoMarcacao: TipoMarcacao | null;
  horarioOriginal: string | null;
  horarioAjustado: string;
  justificativa: string;
  solicitadoPor: number;
}): Promise<void> {
  await sql`
    INSERT INTO ajustes_ponto
      (empresa_id, colaborador_id, registro_ponto_id, tipo_ajuste, tipo_marcacao, horario_original, horario_ajustado, justificativa, solicitado_por)
    VALUES
      (${params.empresaId}, ${params.colaboradorId}, ${params.registroPontoId}, ${params.tipoAjuste}, ${params.tipoMarcacao},
       ${params.horarioOriginal}, ${params.horarioAjustado}, ${params.justificativa}, ${params.solicitadoPor})
  `;
}

export async function listarAjustesPendentes(empresaId: number) {
  return sql<(AjustePonto & { colaborador_nome: string })[]>`
    SELECT a.*, c.nome AS colaborador_nome
    FROM ajustes_ponto a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.empresa_id = ${empresaId} AND a.status = 'pendente'
    ORDER BY a.criado_em
  `;
}

export async function contarAjustesPendentesAntigos(empresaId: number, diasLimite: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*) FROM ajustes_ponto
    WHERE empresa_id = ${empresaId} AND status = 'pendente' AND criado_em < now() - (${diasLimite} || ' days')::interval
  `;
  return Number(rows[0].count);
}

export async function contarAjustesPendentes(empresaId: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`SELECT count(*) FROM ajustes_ponto WHERE empresa_id = ${empresaId} AND status = 'pendente'`;
  return Number(rows[0].count);
}

export async function decidirAjuste(empresaId: number, ajusteId: number, decisao: 'aprovado' | 'rejeitado', analisadoPor: number): Promise<void> {
  await sql`
    UPDATE ajustes_ponto SET status = ${decisao}, analisado_por = ${analisadoPor}, analisado_em = now()
    WHERE empresa_id = ${empresaId} AND id = ${ajusteId} AND status = 'pendente'
  `;
}

export async function listarAjustesColaborador(empresaId: number, colaboradorId: number): Promise<AjustePonto[]> {
  return sql<AjustePonto[]>`
    SELECT * FROM ajustes_ponto WHERE empresa_id = ${empresaId} AND colaborador_id = ${colaboradorId} ORDER BY criado_em DESC
  `;
}
