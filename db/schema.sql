-- Schema do Sistema Argus — Postgres puro, sem ORM (lib `postgres`).
-- Todas as tabelas de negócio (exceto `empresas` em si) carregam
-- empresa_id — todo filtro/relatório da aplicação DEVE incluir
-- `WHERE empresa_id = $1` (ver src/lib/tenant.ts). Não há Row Level
-- Security do Postgres habilitado nesta fase (ver DECISIONS.md) — o
-- isolamento é garantido na camada de aplicação.

-- ============================================================
-- TENANCY: empresa cliente -> unidade -> departamento -> colaborador/dispositivo
-- ============================================================

CREATE TABLE IF NOT EXISTS empresas (
  id            SERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,
  cnpj          TEXT UNIQUE,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unidades (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cidade        TEXT,
  estado        TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unidades_empresa ON unidades(empresa_id);

CREATE TABLE IF NOT EXISTS departamentos (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  unidade_id    INT REFERENCES unidades(id) ON DELETE SET NULL,
  nome          TEXT NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_departamentos_empresa ON departamentos(empresa_id);

-- status: ativo | ferias | afastado | desligado
CREATE TABLE IF NOT EXISTS colaboradores (
  id                      SERIAL PRIMARY KEY,
  empresa_id              INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  unidade_id              INT REFERENCES unidades(id) ON DELETE SET NULL,
  departamento_id         INT REFERENCES departamentos(id) ON DELETE SET NULL,
  nome                    TEXT NOT NULL,
  cargo                   TEXT,
  cpf                     TEXT,
  email                   TEXT,
  telefone                TEXT,
  data_admissao           DATE,
  status                  TEXT NOT NULL DEFAULT 'ativo',
  -- Jornada esperada — usada pelo cálculo de Banco de Horas (ver
  -- src/lib/bancoHoras.ts). Simplificação de MVP: uma jornada única
  -- por colaborador (não por dia da semana) — ver DECISIONS.md.
  jornada_semanal_horas   NUMERIC(5,2) NOT NULL DEFAULT 44,
  horario_entrada_padrao  TIME NOT NULL DEFAULT '08:00',
  horario_saida_padrao    TIME NOT NULL DEFAULT '18:00',
  foto_referencia_url     TEXT,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_colaboradores_empresa ON colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_status ON colaboradores(empresa_id, status);

-- tipo: notebook | celular
CREATE TABLE IF NOT EXISTS dispositivos (
  id                  SERIAL PRIMARY KEY,
  empresa_id          INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id      INT REFERENCES colaboradores(id) ON DELETE SET NULL,
  unidade_id          INT REFERENCES unidades(id) ON DELETE SET NULL,
  tipo                TEXT NOT NULL DEFAULT 'notebook',
  nome                TEXT NOT NULL,
  identificador       TEXT,
  online              BOOLEAN NOT NULL DEFAULT false,
  ultima_latitude     DOUBLE PRECISION,
  ultima_longitude    DOUBLE PRECISION,
  ultima_cidade       TEXT,
  ultimo_ping_em      TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispositivos_empresa ON dispositivos(empresa_id);

-- ============================================================
-- AUTENTICAÇÃO — sessão própria (cookie + tabela), sem framework externo
-- (stack reaproveitada não inclui NextAuth — ver DECISIONS.md).
-- role: ADMIN | GESTOR | COLABORADOR
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id              SERIAL PRIMARY KEY,
  empresa_id      INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id  INT REFERENCES colaboradores(id) ON DELETE SET NULL,
  username        TEXT NOT NULL,
  senha_hash      TEXT NOT NULL,
  nome            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'COLABORADOR',
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Login é por empresa: o mesmo username pode existir em empresas
  -- diferentes (dois clientes distintos), mas não duas vezes na mesma.
  UNIQUE (empresa_id, username)
);

CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT PRIMARY KEY,
  usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);

-- ============================================================
-- CONFIGURAÇÕES — critérios do Ponto IA e limiares de alerta, por empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS criterios_ponto (
  empresa_id                    INT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  verificar_rosto                BOOLEAN NOT NULL DEFAULT true,
  verificar_uniforme              BOOLEAN NOT NULL DEFAULT true,
  verificar_cracha                BOOLEAN NOT NULL DEFAULT true,
  verificar_calcado               BOOLEAN NOT NULL DEFAULT false,
  raio_geolocalizacao_metros      INT NOT NULL DEFAULT 200,
  limiar_atraso_minutos           INT NOT NULL DEFAULT 10,
  limiar_ociosidade_minutos       INT NOT NULL DEFAULT 60,
  limiar_cartao_sem_assinatura_dias INT NOT NULL DEFAULT 5,
  limiar_ajuste_pendente_dias     INT NOT NULL DEFAULT 3,
  percentual_hora_extra_padrao    INT NOT NULL DEFAULT 50,
  atualizado_em                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PONTO IA
-- ============================================================

-- tipo: ENTRADA_1 | SAIDA_1 | ENTRADA_2 | SAIDA_2 | ENTRADA_3 | SAIDA_3
-- Imutável por design: a aplicação nunca faz UPDATE/DELETE aqui, só
-- INSERT (ver src/lib/ponto.ts) — correções acontecem em ajustes_ponto.
CREATE TABLE IF NOT EXISTS registros_ponto (
  id                  SERIAL PRIMARY KEY,
  empresa_id          INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id      INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL,
  registrado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  foto_url            TEXT,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  endereco_aprox      TEXT,
  -- {rosto_ok, uniforme_ok, cracha_ok, calcado_ok, aprovado, confianca, observacao}
  analise_ia          JSONB,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_colab ON registros_ponto(colaborador_id, registrado_em);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_empresa ON registros_ponto(empresa_id, registrado_em);

-- tipo_ajuste: inclusao | correcao | exclusao_justificada
-- status: pendente | aprovado | rejeitado
CREATE TABLE IF NOT EXISTS ajustes_ponto (
  id                  SERIAL PRIMARY KEY,
  empresa_id          INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id      INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  registro_ponto_id   INT REFERENCES registros_ponto(id) ON DELETE SET NULL,
  tipo_ajuste         TEXT NOT NULL,
  tipo_marcacao       TEXT,
  horario_original    TIMESTAMPTZ,
  horario_ajustado    TIMESTAMPTZ NOT NULL,
  justificativa       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pendente',
  solicitado_por      INT REFERENCES usuarios(id) ON DELETE SET NULL,
  analisado_por       INT REFERENCES usuarios(id) ON DELETE SET NULL,
  analisado_em        TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ajustes_ponto_empresa ON ajustes_ponto(empresa_id, status);

-- Assinatura digital do cartão-ponto por período (uma linha por
-- colaborador+período; assinado_em NULL = pendente).
CREATE TABLE IF NOT EXISTS assinaturas_ponto (
  id                SERIAL PRIMARY KEY,
  empresa_id        INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id    INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  periodo_inicio    DATE NOT NULL,
  periodo_fim       DATE NOT NULL,
  assinado_em       TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, periodo_inicio, periodo_fim)
);
CREATE INDEX IF NOT EXISTS idx_assinaturas_pendentes ON assinaturas_ponto(empresa_id, assinado_em);

-- tipo: ferias | afastamento | home_office
-- status: solicitado | aprovado | rejeitado | em_andamento | concluido
CREATE TABLE IF NOT EXISTS eventos_pessoas (
  id              SERIAL PRIMARY KEY,
  empresa_id      INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id  INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  data_inicio     DATE NOT NULL,
  data_fim        DATE,
  status          TEXT NOT NULL DEFAULT 'solicitado',
  observacao      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_pessoas_empresa ON eventos_pessoas(empresa_id, data_inicio);

-- ============================================================
-- USO DIGITAL — ingestão de eventos do agente de desktop (futuro).
-- Ver DECISIONS.md para o contrato do endpoint de ingestão.
-- ============================================================

CREATE TABLE IF NOT EXISTS uso_digital_eventos (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  colaborador_id      INT NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  dispositivo_id      INT REFERENCES dispositivos(id) ON DELETE SET NULL,
  aplicativo_ou_site  TEXT NOT NULL,
  cliques             INT NOT NULL DEFAULT 1,
  ocorrido_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uso_digital_colab ON uso_digital_eventos(colaborador_id, ocorrido_em);
CREATE INDEX IF NOT EXISTS idx_uso_digital_empresa ON uso_digital_eventos(empresa_id, ocorrido_em);

-- Autenticação do futuro agente de desktop (ver DECISIONS.md pro
-- contrato completo do endpoint de ingestão): uma chave de API por
-- empresa + um código estável por colaborador, pra identificar quem
-- mandou o evento sem precisar de sessão de navegador.
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS chave_api TEXT UNIQUE;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS codigo_agente TEXT UNIQUE;
