# Decisões — Sistema Argus

Este documento registra toda decisão de produto/arquitetura que não estava
especificada no briefing original, com o motivo de cada uma. Escrito
durante uma sessão autônoma (o usuário estava dormindo) — sem pausa pra
perguntar, conforme instruído.

## Publicação em `argus.sistemainterno.app`

A mensagem original tinha duas instruções em conflito: "NÃO faça deploy
em nenhum provedor de nuvem sem eu pedir numa próxima conversa" (regra
formal, no meio do briefing) vs. "ai pode colocar
argus.sistemainterno.app" (última linha, curta e informal). Na primeira
passada, tratei a segunda como só uma anotação de domínio pra usar
depois, não como autorização de publicar já — e documentei esse
raciocínio aqui, junto do que faltava antes de publicar com segurança.

Depois você confirmou explicitamente ("pode publicar pra eu ver, e
colocar um localhost ligado tbm") — nesse momento publiquei de verdade.
O que foi feito, seguindo exatamente o padrão já usado pelos outros
produtos Logos nesse mesmo projeto Railway (`pesquisa-campo-campanha`,
id `bb560b4b-8b6b-4aa1-8e9f-6162246ff15c`, ambiente `production`):

- **Postgres de produção dedicado** criado via template Railway
  (`Postgres-8_E2`) — cada app do projeto tem seu próprio banco, não
  compartilha com os outros clientes (confirmado olhando `showroom` e
  `rota-instalacoes`, que seguem o mesmo padrão).
- **Serviço `argus`** criado sem repositório GitHub conectado — o deploy
  foi feito por upload direto do diretório local (`railway deploy` via
  MCP, que empacota e sobe o diretório como está). Isso respeita o "repo
  próprio, comitado localmente" pedido no briefing original: não foi
  necessário criar um repositório remoto pra publicar.
- **Variáveis de ambiente**: `DATABASE_URL` como referência ao serviço
  Postgres (`${{ Postgres-8_E2.DATABASE_URL }}`, endereço interno
  `railway.internal` — `src/lib/db.ts` já detecta isso e desliga SSL
  automaticamente), `SESSION_SECRET` gerado aleatoriamente (diferente do
  valor de dev), `NODE_ENV=production`, `PORT=8080` (mesma porta interna
  que todo app desse projeto usa, ver `router/rotas.js`).
- **Boot de produção** (`scripts/iniciar-producao.sh`, novo nesta
  publicação): roda `db:migrate` sempre (idempotente) e `db:seed` **só
  se a tabela `empresas` estiver vazia** — assim o primeiro boot já
  populam o exemplo sozinho, mas reinícios seguintes do serviço não
  apagam nenhum dado real que você tiver criado depois. `tsx` foi
  movido de `devDependencies` pra `dependencies` porque esse script
  precisa dele em produção, não só em dev.
- **Roteamento**: linha `argus: 'http://argus.railway.internal:8080'`
  adicionada em `router/rotas.js` (repo `sistema-interno-app`, branch
  `main`) — mesmo mecanismo de coringa `*.sistemainterno.app` que os
  outros clientes já usam, sem precisar de DNS novo. Commit `7cf1f75`,
  push direto pra `main` (o roteador é redeployado automaticamente por
  integração GitHub já existente nesse projeto).
- Testado em produção de verdade com Playwright (login, Visão Geral,
  Uso Digital) — sem erro de servidor, dado real do seed aparecendo.

**O que isso NÃO é**: uma homologação de que o sistema está pronto pra
uso real por colaboradores. Os pontos já listados como incompletos
(IA mock, sem storage de foto, sem consentimento LGPD, sem rate
limiting) continuam incompletos — só a infraestrutura de publicação
mudou, não o estado de maturidade do produto.

## Stack e reaproveitamento

- **Next.js 16 (App Router) + TypeScript + `postgres` (sem ORM) +
  Tailwind CSS v4** — exatamente a stack pedida, confirmada olhando o
  `package.json` do outro produto Logos (`logoscompany`, a própria
  landing page do Argus) que já roda nesse conjunto.
- **Design system**: reaproveitei `DESIGN.md` do `logoscompany`
  integralmente (variante "admin/dashboard" descrita lá: cantos retos
  `rounded-sm` em controles, hairline borders em vez de sombra pesada,
  azul (`#2563eb`) só em CTA/estado ativo, ícones de linha finos na
  sidebar) — bate com a descrição do briefing quase palavra por
  palavra, então usei o arquivo de verdade em vez de aproximar da
  descrição. Copiado pra `src/app/globals.css` como variáveis CSS +
  `@theme inline`, com um comentário explicando a origem. Quando você
  mandar o `.md` oficial do design system do Argus, é só substituir os
  valores desse bloco — os componentes (`src/components/ui/*`) já leem
  tudo via classe Tailwind/variável, nenhum estilo inline espalhado.
- **Sem NextAuth**: o `package.json` do produto reaproveitado não inclui
  NextAuth — implementei autenticação própria e simples: cookie
  `httpOnly` + tabela `sessoes` (token aleatório, bcryptjs pra senha).
  Ver `src/lib/auth.ts` e `src/lib/sessaoServidor.ts`.
- **Schema como arquivo único** (`db/schema.sql` + `scripts/migrate.ts`),
  em vez do padrão `ensureSchema()` inline por módulo que o
  `logoscompany` usa (lá faz sentido, é uma tabela só). Aqui são ~13
  tabelas interrelacionadas — um arquivo central com `CREATE TABLE IF
  NOT EXISTS`/`ALTER TABLE ADD COLUMN IF NOT EXISTS` é mais fácil de
  ler e continua idempotente (testado rodando duas vezes seguidas).
- **`react-leaflet` v5** (não v4, que era o mais "padrão" na hora de
  escrever) — v4 declara peer dependency de React 18, e o projeto está
  em React 19 (mesma versão do `logoscompany`); v5 suporta React 19
  sem conflito.
- **Next.js 16 removeu a opção `eslint` do `next.config`** (build não
  tenta mais rodar lint sozinho) — confirmado comparando com o
  `next.config.ts` do `logoscompany`, que também não tem essa opção.
  Não configurei lint-on-build por conta disso; `npm run lint` continua
  disponível separadamente.

## Multi-tenant e autenticação

- Login é **por empresa**: `username` é único por `empresa_id`, não
  globalmente — duas empresas clientes podem ter cada uma um usuário
  "admin" sem colidir. Toda query em `src/lib/*.ts` filtra por
  `empresa_id` na cláusula `WHERE` — não há Row Level Security do
  Postgres habilitado, o isolamento é 100% na camada de aplicação
  (mais simples de auditar/testar num prazo curto; RLS seria o próximo
  passo natural se isso crescer).
- `role` tem três valores (`ADMIN`, `GESTOR`, `COLABORADOR`) no schema e
  no tipo TypeScript, mas **só `ADMIN` tem controle de acesso
  implementado de verdade** hoje (`exigirAdmin()` existe mas não é
  usado em nenhuma tela ainda porque toda tela admin já exige `ADMIN`
  via `exigirSessao()` — reveja se quiser um nível "gestor de uma
  unidade só" de verdade, isso ainda não existe). `COLABORADOR` só é
  usado no fluxo de `/checkin` (registrar o próprio ponto).
- Só semeei **uma conta de login** (`admin`/`argus2026`, role ADMIN, sem
  `colaborador_id`). Os ~20 colaboradores de exemplo **não têm login
  próprio** — pra testar o check-in "como colaborador" de verdade, seria
  preciso criar uma conta com `role = COLABORADOR` e `colaborador_id`
  apontando pra um deles (não fiz isso automaticamente no seed pra não
  multiplicar sem necessidade; é trivial de adicionar). Por isso
  `/checkin` deixa o ADMIN escolher "em nome de quem" registrar — é o
  jeito de testar o fluxo inteiro sem precisar logar como outro usuário.

## Ponto IA

- **Análise de IA é um mock determinístico** (`src/lib/analiseIa.ts`) —
  não chama nenhuma API de visão computacional de verdade. Gera um
  resultado plausível (rosto/uniforme/crachá/calçado, aprovado/
  reprovado, confiança) a partir de um hash simples da foto+colaborador,
  então o mesmo par sempre dá o mesmo resultado (repetível, bom pra
  demonstração/teste). **Contrato de substituição**: trocar só o corpo
  dessa função por uma chamada real (ex: AWS Rekognition pra rosto —
  o `logoscompany` já usa `@aws-sdk/client-s3`, então a conta AWS já
  existe; Rekognition é outro serviço da mesma AWS) mantendo a mesma
  assinatura — nenhum outro módulo precisa mudar.
- **A selfie em si não é persistida** — não configurei storage de
  objeto (S3/similar) nesta sessão. O campo `foto_url` existe no schema
  pronto pra isso; a análise de IA roda em cima da imagem recebida no
  momento do check-in, mas ela não é salva em lugar nenhum depois. Pra
  produção, plugar S3 (mesmo padrão do `logoscompany`) antes de ir ao
  ar — foto de rosto é dado biométrico sensível (ver seção LGPD abaixo).
- **Registro nunca bloqueado**: `registrarPonto()` sempre grava, mesmo
  se a análise reprovar — é literal no código, não uma promessa de UI.
  O resultado da análise (`analise_ia` jsonb) só aparece pra gestão (não
  construí uma tela específica de "revisar reprovações" além do que já
  aparece implicitamente no dado — se quiser uma fila dedicada de
  "check-ins reprovados pela IA", é a próxima tela óbvia a adicionar).
- **Banco de horas**: expectativa diária = intervalo entre
  `horario_entrada_padrao` e `horario_saida_padrao` do colaborador — não
  desconta almoço automaticamente (se o colaborador bate 4 marcações
  num dia normal, ENTRADA_1→SAIDA_1 e ENTRADA_2→SAIDA_2 já capturam o
  intervalo de almoço naturalmente como "não trabalhado", então isso já
  funciona certo pra jornada com 1 intervalo; jornada com um único par
  entrada/saída sem intervalo também funciona). Não existe jornada
  diferente por dia da semana (mesma jornada todo dia útil) nem cálculo
  de hora extra noturna/feriado — fórmula fica visível na tela do
  Cartão Ponto pra ficar claro exatamente o que está sendo calculado.
- Só dias de **segunda a sexta** contam `minutosEsperados` — sábado/
  domingo têm expectativa zero (qualquer trabalho nesses dias já cai
  inteiro como "extra", correto pro banco de horas mesmo sem ser
  ajustável por enquanto).
- **Ajuste de ponto**: nunca toca `registros_ponto` (imutável de
  verdade — sem UPDATE/DELETE nenhum nesse código, só INSERT). Um
  ajuste aprovado é aplicado matematicamente por cima na hora de montar
  o dia (`src/lib/bancoHoras.ts`), o registro original nunca muda.
- **"Admissões em andamento"** (card da Visão Geral) é uma aproximação:
  conta colaboradores com `data_admissao` nos últimos 30 dias — não
  existe um módulo de onboarding formal com etapas (nada foi pedido
  sobre isso além do card em si).
- **Motor de regras** = a tabela `criterios_ponto` (limiares
  configuráveis por empresa em `/configuracoes`), não um motor de regras
  genérico com condições arbitrárias — cobre exatamente os limiares
  citados no briefing (atraso, ociosidade, cartão sem assinatura, ajuste
  pendente). Se precisar de regras mais livres (ex: "atraso >15min E
  aconteceu 3x no mês"), isso pede um motor de verdade — não construí
  isso agora.

## Uso Digital

- **Agente de desktop não construído** (confirmado explicitamente fora
  de escopo) — só o backend: schema, endpoint de ingestão, todas as
  telas com dado de exemplo.
- **Contrato de ingestão** (`POST /api/uso-digital/eventos`, ver
  comentário completo no próprio arquivo de rota): autenticação por
  **chave de API por empresa** (`empresas.chave_api`, header
  `Authorization: Bearer <chave>`) — não por sessão de navegador, porque
  o agente roda em background sem ninguém logado. Cada colaborador
  ganha um `codigo_agente` estável (ex: `AGT-1000`) pro agente se
  identificar no payload sem precisar saber o ID interno do banco. O
  agente deveria mandar em lote (ex: a cada 1-5min, cliques acumulados
  por app), não um POST por clique — documentado no comentário da rota.
- Métricas (Top 5, distribuição, ofensores, evolução semanal) são todas
  calculadas por query direta em `uso_digital_eventos`, sem tabela de
  agregação/rollup — no volume de dados de um agente real (milhares de
  eventos/dia por empresa), isso provavelmente precisa de agregação
  pré-calculada (job noturno ou trigger) antes de virar lento; não
  otimizei isso agora porque não há dado real nessa escala pra medir.

## Modo claro/escuro

- Pedido depois de já publicado, pra ficar igual ao alternador do
  painel `logoscompany` (sol/lua na sidebar). Copiei o mecanismo de lá
  quase igual: classe `dark` em `document.documentElement` (não
  `data-theme`, não Context/Provider), `localStorage` por navegador
  (`argus-theme`), e um `<script>` bloqueante em `layout.tsx` que roda
  antes da primeira pintura pra aplicar o tema salvo sem piscar claro
  primeiro.
- Tive que acrescentar `suppressHydrationWarning` na tag `<html>` — o
  `logoscompany` não precisou porque lá o layout com o script fica numa
  árvore separada (`/admin/layout.tsx`, fora do `[locale]`), enquanto o
  Argus tem um único layout raiz. Sem isso, o React reclamava de
  hydration mismatch (classe `dark` aparece no DOM antes da hidratação,
  servidor não sabia disso ao renderizar). Confirmado com Playwright que
  não sobra warning nenhum no console depois da correção.
- Aplica no site inteiro (login/checkin incluído), não só no admin —
  diferente do `logoscompany`, que restringe a `/admin`. Não vi motivo
  pra restringir aqui, já que não existe "site público" separado no
  Argus (tudo é painel ou tela de check-in).

## Conformidade (LGPD / REP-P)

- Arquitetado pensando na Portaria 671/2021: `registros_ponto` é
  imutável de propósito (sem UPDATE/DELETE no código — só INSERT),
  timestamp vem do servidor (`registrado_em TIMESTAMPTZ DEFAULT now()`,
  nunca do cliente), correção só via `ajustes_ponto` com justificativa
  obrigatória e aprovação. **Não tentei homologação formal** — isso é
  processo com o Ministério do Trabalho, fora do escopo de uma sessão
  de código, como já avisado no briefing.
- **Foto de rosto é dado biométrico sensível (LGPD)** — nada foi
  implementado sobre consentimento explícito nem política de retenção/
  expurgo. Antes de produção de verdade, precisa de: (1) tela de termo
  de consentimento no primeiro check-in de cada colaborador, com
  registro de aceite (parecido com o padrão que o outro produto Logos
  já usa pra pesquisa de campo — `eventos_pessoas`/consentimento lá
  serve de referência de como fazer isso aqui), e (2) uma política
  clara de quanto tempo a foto fica guardada (hoje nem é guardada,
  então isso também depende de decidir o storage — ver seção Ponto IA
  acima).

## O que ficou pra depois (fora da lista de prioridades, ou cortado por tempo)

- Edição completa de cadastros (unidade/departamento/dispositivo) — só
  criação + listagem; colaborador tem alterar-status mas não editar os
  outros campos depois de criado. Nenhuma tela de exclusão em lugar
  nenhum (intencional: mais seguro não ter delete ainda que criar sem
  querer errado).
- Rate limiting / bloqueio de conta após tentativas de login erradas —
  não implementado.
- Exportação CSV em qualquer tela (o `logoscompany` tem isso em
  Militantes) — não pedido no briefing do Argus, não implementei.
- Testes automatizados formais (Jest/Playwright como suíte do
  repositório) — validei manualmente com scripts Playwright avulsos
  durante a sessão (não commitados), mas não configurei uma suíte de
  testes de verdade no projeto.
