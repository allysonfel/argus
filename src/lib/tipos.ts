export type Unidade = {
  id: number;
  empresa_id: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
};

export type Departamento = {
  id: number;
  empresa_id: number;
  unidade_id: number | null;
  nome: string;
  criado_em: string;
};

export type StatusColaborador = 'ativo' | 'ferias' | 'afastado' | 'desligado';

export type Colaborador = {
  id: number;
  empresa_id: number;
  unidade_id: number | null;
  departamento_id: number | null;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  data_admissao: string | null;
  status: StatusColaborador;
  jornada_semanal_horas: string;
  horario_entrada_padrao: string;
  horario_saida_padrao: string;
  foto_referencia_url: string | null;
  criado_em: string;
};

export type Dispositivo = {
  id: number;
  empresa_id: number;
  colaborador_id: number | null;
  unidade_id: number | null;
  tipo: 'notebook' | 'celular';
  nome: string;
  identificador: string | null;
  online: boolean;
  ultima_latitude: number | null;
  ultima_longitude: number | null;
  ultima_cidade: string | null;
  ultimo_ping_em: string | null;
  criado_em: string;
};

export type TipoMarcacao = 'ENTRADA_1' | 'SAIDA_1' | 'ENTRADA_2' | 'SAIDA_2' | 'ENTRADA_3' | 'SAIDA_3';

export type AnaliseIA = {
  rosto_ok: boolean;
  uniforme_ok: boolean;
  cracha_ok: boolean;
  calcado_ok: boolean;
  aprovado: boolean;
  confianca: number;
  observacao: string;
};

export type RegistroPonto = {
  id: number;
  empresa_id: number;
  colaborador_id: number;
  tipo: TipoMarcacao;
  registrado_em: string;
  foto_url: string | null;
  latitude: number | null;
  longitude: number | null;
  endereco_aprox: string | null;
  analise_ia: AnaliseIA | null;
  criado_em: string;
};

export type StatusAjuste = 'pendente' | 'aprovado' | 'rejeitado';

export type AjustePonto = {
  id: number;
  empresa_id: number;
  colaborador_id: number;
  registro_ponto_id: number | null;
  tipo_ajuste: 'inclusao' | 'correcao' | 'exclusao_justificada';
  tipo_marcacao: TipoMarcacao | null;
  horario_original: string | null;
  horario_ajustado: string;
  justificativa: string;
  status: StatusAjuste;
  solicitado_por: number | null;
  analisado_por: number | null;
  analisado_em: string | null;
  criado_em: string;
};

export type AssinaturaPonto = {
  id: number;
  empresa_id: number;
  colaborador_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  assinado_em: string | null;
  criado_em: string;
};

export type EventoPessoa = {
  id: number;
  empresa_id: number;
  colaborador_id: number;
  tipo: 'ferias' | 'afastamento' | 'home_office';
  data_inicio: string;
  data_fim: string | null;
  status: 'solicitado' | 'aprovado' | 'rejeitado' | 'em_andamento' | 'concluido';
  observacao: string | null;
  criado_em: string;
};

export type CriteriosPonto = {
  empresa_id: number;
  verificar_rosto: boolean;
  verificar_uniforme: boolean;
  verificar_cracha: boolean;
  verificar_calcado: boolean;
  raio_geolocalizacao_metros: number;
  limiar_atraso_minutos: number;
  limiar_ociosidade_minutos: number;
  limiar_cartao_sem_assinatura_dias: number;
  limiar_ajuste_pendente_dias: number;
  percentual_hora_extra_padrao: number;
  atualizado_em: string;
};
