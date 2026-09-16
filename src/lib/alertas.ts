import { sql } from './db';

export type Atraso = {
  colaborador_id: number;
  colaborador_nome: string;
  unidade_nome: string | null;
  horario_esperado: string;
  horario_real: string;
  minutos_atraso: number;
};

/** Quem já bateu ENTRADA_1 hoje, mas depois do horário padrão + limiar. */
export async function listarAtrasosDoDia(empresaId: number, limiarMinutos: number): Promise<Atraso[]> {
  return sql<Atraso[]>`
    SELECT
      c.id AS colaborador_id,
      c.nome AS colaborador_nome,
      u.nome AS unidade_nome,
      c.horario_entrada_padrao::text AS horario_esperado,
      to_char(r.registrado_em, 'HH24:MI') AS horario_real,
      GREATEST(0, EXTRACT(EPOCH FROM (r.registrado_em::time - c.horario_entrada_padrao)) / 60)::int AS minutos_atraso
    FROM registros_ponto r
    JOIN colaboradores c ON c.id = r.colaborador_id
    LEFT JOIN unidades u ON u.id = c.unidade_id
    WHERE r.empresa_id = ${empresaId} AND r.tipo = 'ENTRADA_1' AND r.registrado_em::date = current_date
      AND EXTRACT(EPOCH FROM (r.registrado_em::time - c.horario_entrada_padrao)) / 60 > ${limiarMinutos}
    ORDER BY minutos_atraso DESC
  `;
}

export type ColaboradorSemRegistro = {
  colaborador_id: number;
  colaborador_nome: string;
  unidade_nome: string | null;
  horario_esperado: string;
  minutos_atraso: number;
};

/** Ativos que ainda não bateram NENHUM ponto hoje, já passado o horário
 * esperado + limiar — mais grave que "atraso" (atraso já registrou, esse
 * nem apareceu). */
export async function listarSemRegistroHoje(empresaId: number, limiarMinutos: number): Promise<ColaboradorSemRegistro[]> {
  return sql<ColaboradorSemRegistro[]>`
    SELECT
      c.id AS colaborador_id,
      c.nome AS colaborador_nome,
      u.nome AS unidade_nome,
      c.horario_entrada_padrao::text AS horario_esperado,
      GREATEST(0, EXTRACT(EPOCH FROM (localtime - c.horario_entrada_padrao)) / 60)::int AS minutos_atraso
    FROM colaboradores c
    LEFT JOIN unidades u ON u.id = c.unidade_id
    WHERE c.empresa_id = ${empresaId} AND c.status = 'ativo'
      AND EXTRACT(EPOCH FROM (localtime - c.horario_entrada_padrao)) / 60 > ${limiarMinutos}
      AND NOT EXISTS (
        SELECT 1 FROM registros_ponto r
        WHERE r.colaborador_id = c.id AND r.registrado_em::date = current_date
      )
    ORDER BY minutos_atraso DESC
  `;
}
