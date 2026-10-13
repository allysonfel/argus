import { sql } from '../db';

// Configurações do shopping (tela Configurações, só o administrador geral).
// Uma linha por empresa, criada com os padrões na primeira leitura.

export type ConfiguracoesShopping = {
  empresa_id: number;
  nome: string;
  cidade: string;
  logo: string | null;
  fuso: string;
  abre: string;
  fecha: string;
  domingo_abre: string;
  domingo_fecha: string;
  retencao_evidencias_dias: number;
  retencao_busca_crianca_horas: number;
  pergunte_ativo: boolean;
  pergunte_limite_dia: number;
  deteccao_confianca: number;
  deteccao_fps: number;
  sessao_horas: number;
  max_tentativas: number;
  bloqueio_minutos: number;
  atualizado_em: Date;
};

export async function obterConfiguracoes(empresaId: number): Promise<ConfiguracoesShopping> {
  const [linha] = await sql<ConfiguracoesShopping[]>`
    INSERT INTO configuracoes_shopping (empresa_id) VALUES (${empresaId})
    ON CONFLICT (empresa_id) DO UPDATE SET empresa_id = EXCLUDED.empresa_id
    RETURNING *
  `;
  return linha;
}

export type CamposConfiguracoes = Omit<ConfiguracoesShopping, 'empresa_id' | 'atualizado_em'>;

export async function salvarConfiguracoes(empresaId: number, c: CamposConfiguracoes): Promise<void> {
  await obterConfiguracoes(empresaId);
  await sql`
    UPDATE configuracoes_shopping SET
      nome = ${c.nome}, cidade = ${c.cidade}, logo = ${c.logo}, fuso = ${c.fuso},
      abre = ${c.abre}, fecha = ${c.fecha}, domingo_abre = ${c.domingo_abre}, domingo_fecha = ${c.domingo_fecha},
      retencao_evidencias_dias = ${c.retencao_evidencias_dias}, retencao_busca_crianca_horas = ${c.retencao_busca_crianca_horas},
      pergunte_ativo = ${c.pergunte_ativo}, pergunte_limite_dia = ${c.pergunte_limite_dia},
      deteccao_confianca = ${c.deteccao_confianca}, deteccao_fps = ${c.deteccao_fps},
      sessao_horas = ${c.sessao_horas}, max_tentativas = ${c.max_tentativas}, bloqueio_minutos = ${c.bloqueio_minutos},
      atualizado_em = now()
    WHERE empresa_id = ${empresaId}
  `;
}
