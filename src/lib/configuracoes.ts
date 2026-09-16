import { sql } from './db';
import type { CriteriosPonto } from './tipos';

/** Garante uma linha de critérios pra empresa (defaults do schema) e a devolve. */
export async function obterCriterios(empresaId: number): Promise<CriteriosPonto> {
  const existentes = await sql<CriteriosPonto[]>`SELECT * FROM criterios_ponto WHERE empresa_id = ${empresaId}`;
  if (existentes[0]) return existentes[0];

  const criados = await sql<CriteriosPonto[]>`
    INSERT INTO criterios_ponto (empresa_id) VALUES (${empresaId})
    ON CONFLICT (empresa_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id
    RETURNING *
  `;
  return criados[0];
}

export async function atualizarCriterios(empresaId: number, dados: Partial<Omit<CriteriosPonto, 'empresa_id' | 'atualizado_em'>>) {
  await obterCriterios(empresaId); // garante que a linha existe antes do UPDATE
  await sql`
    UPDATE criterios_ponto SET
      verificar_rosto = ${dados.verificar_rosto ?? sql`verificar_rosto`},
      verificar_uniforme = ${dados.verificar_uniforme ?? sql`verificar_uniforme`},
      verificar_cracha = ${dados.verificar_cracha ?? sql`verificar_cracha`},
      verificar_calcado = ${dados.verificar_calcado ?? sql`verificar_calcado`},
      raio_geolocalizacao_metros = ${dados.raio_geolocalizacao_metros ?? sql`raio_geolocalizacao_metros`},
      limiar_atraso_minutos = ${dados.limiar_atraso_minutos ?? sql`limiar_atraso_minutos`},
      limiar_ociosidade_minutos = ${dados.limiar_ociosidade_minutos ?? sql`limiar_ociosidade_minutos`},
      limiar_cartao_sem_assinatura_dias = ${dados.limiar_cartao_sem_assinatura_dias ?? sql`limiar_cartao_sem_assinatura_dias`},
      limiar_ajuste_pendente_dias = ${dados.limiar_ajuste_pendente_dias ?? sql`limiar_ajuste_pendente_dias`},
      percentual_hora_extra_padrao = ${dados.percentual_hora_extra_padrao ?? sql`percentual_hora_extra_padrao`},
      atualizado_em = now()
    WHERE empresa_id = ${empresaId}
  `;
}
