import { sql } from './db';

/**
 * Ingestão de um evento de uso digital — chamado hoje só pelo seed (dados
 * de exemplo). O contrato de produção (agente de desktop -> este backend)
 * está documentado em DECISIONS.md: POST /api/uso-digital/eventos com
 * { colaboradorToken, aplicativoOuSite, cliques, ocorridoEm }.
 */
export async function registrarEventoUso(params: {
  empresaId: number;
  colaboradorId: number;
  dispositivoId: number | null;
  aplicativoOuSite: string;
  cliques: number;
  ocorridoEm: Date;
}): Promise<void> {
  await sql`
    INSERT INTO uso_digital_eventos (empresa_id, colaborador_id, dispositivo_id, aplicativo_ou_site, cliques, ocorrido_em)
    VALUES (${params.empresaId}, ${params.colaboradorId}, ${params.dispositivoId}, ${params.aplicativoOuSite}, ${params.cliques}, ${params.ocorridoEm})
  `;
}

export async function resumoUsoDigital(empresaId: number, inicio: string, fim: string) {
  const rows = await sql<{ funcionarios: string; cliques: string }[]>`
    SELECT count(DISTINCT colaborador_id) AS funcionarios, COALESCE(sum(cliques), 0) AS cliques
    FROM uso_digital_eventos
    WHERE empresa_id = ${empresaId} AND ocorrido_em::date >= ${inicio}::date AND ocorrido_em::date <= ${fim}::date
  `;
  const funcionarios = Number(rows[0].funcionarios);
  const cliques = Number(rows[0].cliques);
  return { funcionariosMonitorados: funcionarios, cliquesTotais: cliques, mediaPorFuncionario: funcionarios ? Math.round(cliques / funcionarios) : 0 };
}

export async function topColaboradoresAtividade(empresaId: number, inicio: string, fim: string, limite = 5) {
  return sql<{ colaborador_id: number; nome: string; cliques: string }[]>`
    SELECT c.id AS colaborador_id, c.nome, sum(u.cliques) AS cliques
    FROM uso_digital_eventos u
    JOIN colaboradores c ON c.id = u.colaborador_id
    WHERE u.empresa_id = ${empresaId} AND u.ocorrido_em::date >= ${inicio}::date AND u.ocorrido_em::date <= ${fim}::date
    GROUP BY c.id, c.nome
    ORDER BY cliques DESC
    LIMIT ${limite}
  `;
}

export async function distribuicaoPorColaborador(empresaId: number, inicio: string, fim: string) {
  return sql<{ nome: string; cliques: string }[]>`
    SELECT c.nome, sum(u.cliques) AS cliques
    FROM uso_digital_eventos u JOIN colaboradores c ON c.id = u.colaborador_id
    WHERE u.empresa_id = ${empresaId} AND u.ocorrido_em::date >= ${inicio}::date AND u.ocorrido_em::date <= ${fim}::date
    GROUP BY c.nome ORDER BY cliques DESC
  `;
}

export async function distribuicaoPorUnidade(empresaId: number, inicio: string, fim: string) {
  return sql<{ nome: string; cliques: string }[]>`
    SELECT COALESCE(un.nome, 'Sem unidade') AS nome, sum(u.cliques) AS cliques
    FROM uso_digital_eventos u
    JOIN colaboradores c ON c.id = u.colaborador_id
    LEFT JOIN unidades un ON un.id = c.unidade_id
    WHERE u.empresa_id = ${empresaId} AND u.ocorrido_em::date >= ${inicio}::date AND u.ocorrido_em::date <= ${fim}::date
    GROUP BY un.nome ORDER BY cliques DESC
  `;
}

export async function distribuicaoPorDepartamento(empresaId: number, inicio: string, fim: string) {
  return sql<{ nome: string; cliques: string }[]>`
    SELECT COALESCE(d.nome, 'Sem departamento') AS nome, sum(u.cliques) AS cliques
    FROM uso_digital_eventos u
    JOIN colaboradores c ON c.id = u.colaborador_id
    LEFT JOIN departamentos d ON d.id = c.departamento_id
    WHERE u.empresa_id = ${empresaId} AND u.ocorrido_em::date >= ${inicio}::date AND u.ocorrido_em::date <= ${fim}::date
    GROUP BY d.nome ORDER BY cliques DESC
  `;
}

export async function mediaCliquesPorUnidade(empresaId: number, inicio: string, fim: string) {
  return sql<{ unidade: string; media: number }[]>`
    SELECT COALESCE(un.nome, 'Sem unidade') AS unidade, round(avg(por_colab.cliques))::int AS media
    FROM (
      SELECT c.id, COALESCE(un2.nome, 'Sem unidade') AS unidade_nome, sum(u.cliques) AS cliques
      FROM colaboradores c
      LEFT JOIN unidades un2 ON un2.id = c.unidade_id
      LEFT JOIN uso_digital_eventos u ON u.colaborador_id = c.id AND u.ocorrido_em::date >= ${inicio}::date AND u.ocorrido_em::date <= ${fim}::date
      WHERE c.empresa_id = ${empresaId}
      GROUP BY c.id, un2.nome
    ) AS por_colab(id, unidade_nome, cliques)
    JOIN unidades un ON un.nome = por_colab.unidade_nome
    GROUP BY un.nome
    ORDER BY media DESC
  `;
}

/** Evolução semanal de cliques por colaborador, últimas N semanas —
 * usado no gráfico de linha (um colaborador por vez, selecionado na UI). */
export async function evolucaoSemanalColaborador(empresaId: number, colaboradorId: number, semanas: number) {
  return sql<{ semana: string; cliques: string }[]>`
    SELECT to_char(date_trunc('week', ocorrido_em), 'DD/MM') AS semana, sum(cliques) AS cliques
    FROM uso_digital_eventos
    WHERE empresa_id = ${empresaId} AND colaborador_id = ${colaboradorId}
      AND ocorrido_em >= date_trunc('week', now()) - (${semanas} || ' weeks')::interval
    GROUP BY date_trunc('week', ocorrido_em)
    ORDER BY date_trunc('week', ocorrido_em)
  `;
}

/** "Colaboradores ofensores": menor média de cliques/dia nos últimos N
 * dias, entre os ativos — possível ociosidade/desengajamento. */
export async function colaboradoresOfensores(empresaId: number, dias: number, limite = 10) {
  return sql<{ colaborador_id: number; nome: string; media_diaria: number }[]>`
    SELECT c.id AS colaborador_id, c.nome, COALESCE(round(sum(u.cliques)::numeric / ${dias}, 1), 0) AS media_diaria
    FROM colaboradores c
    LEFT JOIN uso_digital_eventos u ON u.colaborador_id = c.id AND u.ocorrido_em >= now() - (${dias} || ' days')::interval
    WHERE c.empresa_id = ${empresaId} AND c.status = 'ativo'
    GROUP BY c.id, c.nome
    ORDER BY media_diaria ASC
    LIMIT ${limite}
  `;
}
