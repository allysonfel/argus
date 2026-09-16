import { sql } from './db';
import type { AssinaturaPonto } from './tipos';

/** Garante que existe uma pendência de assinatura pro colaborador+período
 * (idempotente via UNIQUE) — chamado ao fechar um período (ver seed e,
 * futuramente, um job agendado no fim de cada mês). */
export async function garantirPendenciaAssinatura(empresaId: number, colaboradorId: number, inicio: string, fim: string): Promise<void> {
  await sql`
    INSERT INTO assinaturas_ponto (empresa_id, colaborador_id, periodo_inicio, periodo_fim)
    VALUES (${empresaId}, ${colaboradorId}, ${inicio}, ${fim})
    ON CONFLICT (colaborador_id, periodo_inicio, periodo_fim) DO NOTHING
  `;
}

export async function listarAssinaturasPendentes(empresaId: number) {
  return sql<(AssinaturaPonto & { colaborador_nome: string })[]>`
    SELECT a.*, c.nome AS colaborador_nome
    FROM assinaturas_ponto a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.empresa_id = ${empresaId} AND a.assinado_em IS NULL
    ORDER BY a.periodo_inicio
  `;
}

export async function contarAssinaturasPendentesAntigas(empresaId: number, diasLimite: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT count(*) FROM assinaturas_ponto
    WHERE empresa_id = ${empresaId} AND assinado_em IS NULL AND periodo_fim < current_date - ${diasLimite}::int
  `;
  return Number(rows[0].count);
}

export async function assinarPeriodo(empresaId: number, assinaturaId: number): Promise<void> {
  await sql`UPDATE assinaturas_ponto SET assinado_em = now() WHERE empresa_id = ${empresaId} AND id = ${assinaturaId} AND assinado_em IS NULL`;
}

export async function listarAssinaturasColaborador(empresaId: number, colaboradorId: number): Promise<AssinaturaPonto[]> {
  return sql<AssinaturaPonto[]>`
    SELECT * FROM assinaturas_ponto WHERE empresa_id = ${empresaId} AND colaborador_id = ${colaboradorId} ORDER BY periodo_inicio DESC
  `;
}
