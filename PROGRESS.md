# Progresso — Sistema Argus

Bom dia. Isso foi construído numa sessão autônoma noturna, sem pausar pra
te perguntar nada (por instrução sua). Leia isto primeiro. O
`DECISIONS.md` tem o porquê de cada escolha não especificada; aqui é só
o estado das coisas.

## Publicado: `argus.sistemainterno.app`

Inicialmente não publiquei (mensagem tinha duas instruções em conflito —
ver histórico no `DECISIONS.md`). Você confirmou explicitamente depois
("pode publicar pra eu ver") e nesse ponto publiquei de verdade, seguindo
o mesmo padrão dos outros produtos Logos nesse projeto Railway
compartilhado (`pesquisa-campo-campanha`):

- Serviço `argus` (Railway, deploy direto do diretório local via
  upload/tarball — não precisou de GitHub, já que o repo é só local
  mesmo, como pedido).
- Postgres de produção dedicado: `Postgres-8_E2`.
- Schema aplicado e seed de exemplo rodados automaticamente no primeiro
  boot (ver `scripts/iniciar-producao.sh` — o seed só roda se a tabela
  `empresas` estiver vazia, pra não apagar dado real em reinícios
  futuros).
- Rota adicionada em `router/rotas.js` (repo `sistema-interno-app`,
  branch `main`) e roteador redeployado.
- Testado em produção de verdade (Playwright: login + dashboard + Uso
  Digital, sem erro).

**Acesse**: https://argus.sistemainterno.app — login `admin` /
`argus2026`.

Continuam valendo os pontos já documentados como incompletos (IA mock,
sem storage de foto, sem consentimento LGPD, sem rate limiting) — é
uma versão pra você ver e testar, não uma versão pronta pra
colaboradores reais baterem ponto de verdade ainda. Ver `DECISIONS.md`
pro que falta antes disso.

### Rodando local também

Servidor de dev também está de pé, em paralelo: **http://localhost:4300**
(mesmo login). Usa o Postgres local (Homebrew), dados de exemplo
próprios — independente do banco de produção.

## Como rodar

```
npm install
npm run db:migrate   # cria o schema (idempotente)
npm run db:seed       # popula dados de exemplo (Construtora Nordeste Ltda)
npm run dev
```

Login: **`admin`** / **`argus2026`** — em `http://localhost:3000/login`.
Requer Postgres local rodando com `DATABASE_URL` em `.env.local` (ver
`.env.example`).

## O que está pronto e testado

Testei tudo abaixo com Playwright de verdade (não só `tsc --noEmit`) e
conferindo dado direto no Postgres via `psql` nos pontos mais sensíveis
(persistência de cadastro, persistência de configuração). As 15 rotas
abaixo carregam com status 200 e sem erro de servidor/console:

- **Autenticação**: login/logout por empresa, sessão em cookie httpOnly.
- **Multi-tenant**: Empresa → Unidades → Departamentos → Colaboradores +
  Dispositivos, com isolamento por `empresa_id` em toda query.
- **Cadastros** (`/cadastros/...`): listar + criar unidade, departamento,
  colaborador, dispositivo. Colaborador tem alterar-status inline
  (ativo/férias/afastado/desligado). *Não* tem edição de campos depois
  de criado nem exclusão — ver `DECISIONS.md`.
- **Ponto IA** (`/checkin`, `/ponto`, `/ponto/[id]`):
  - Check-in com selfie (upload), grava sempre, roda análise de IA mock
    em paralelo (nunca bloqueia o registro).
  - Cartão Ponto por colaborador: todas as marcações do período, horas
    trabalhadas por dia, divergência da jornada esperada.
  - Banco de Horas: fórmula visível na tela (esperado vs. trabalhado,
    extra com percentual configurável, hora negativa, saldo final).
  - Ajuste de ponto com justificativa (fluxo pedir → aprovar/reprovar),
    nunca edita o registro original.
  - Assinatura digital do cartão por período (botão de confirmar com
    timestamp) + `/ponto/pendencias` listando cartões não assinados.
- **Visão Geral** (`/`): saudação, contagem "precisa de atenção", cards
  resumo (ativos, presentes hoje, admissões recentes, pendências),
  painel "O que precisa da sua atenção" com link direto pra resolver
  cada item, "Pessoas em movimento" (eventos próximos), "Atrasos do
  Dia".
- **Rastreamento**:
  - `/mapa-dispositivos`: mapa Leaflet do Brasil, online/offline,
    contadores, busca por colaborador/unidade/cidade.
  - `/mapa-ponto`: mapa geográfico de onde cada check-in aconteceu,
    contagem no período, filtro de data, busca por colaborador.
- **Uso Digital** (`/uso-digital`): total monitorado, cliques no
  período, média por colaborador, Top 5, distribuição (por
  colaborador/unidade/departamento), gráfico de barras por unidade,
  evolução semanal (linha), lista de colaboradores ofensores. Backend
  completo: `POST /api/uso-digital/eventos` com autenticação por chave
  de API (contrato documentado no `DECISIONS.md` pro futuro agente de
  desktop, que **não foi construído** — fora de escopo combinado).
- **Configurações** (`/configuracoes`): critérios do Ponto IA (rosto/
  uniforme/crachá/calçado, raio de geolocalização), limiares de alerta
  (atraso, ociosidade, cartão sem assinatura, ajuste pendente),
  percentual de hora extra. Confirmado persistindo direto no Postgres.
- **Modo claro/escuro**: alternador sol/lua na sidebar (mesmo padrão
  visual do painel `logoscompany`), escolha salva por navegador
  (`localStorage`), sem piscar tema errado no carregamento. Testado
  local e em produção.

## O que ficou pra depois (nada foi "pulado" por trava técnica — tudo abaixo é escopo cortado conscientemente por tempo, com nota no `DECISIONS.md`)

- Deploy em `argus.sistemainterno.app` — ver seção acima.
- Consentimento LGPD pra foto biométrica + política de retenção — não
  implementado, documentado como obrigatório antes de produção real.
- Storage de imagem (S3 ou similar) pra guardar a selfie — hoje a foto
  não é persistida, só analisada no momento.
- Login individual por colaborador (só existe o admin `admin`/
  `argus2026`) — o check-in em `/checkin` deixa o admin escolher "em
  nome de quem" registrar, pra dar pra testar o fluxo inteiro sem mais
  contas.
- Edição/exclusão de cadastros já criados.
- Rate limiting / bloqueio de login.
- Suíte de testes automatizados formal — validei com scripts Playwright
  avulsos durante a sessão, não commitados como suíte do projeto.
- Papel `GESTOR` existe no schema/tipo mas sem permissão distinta de
  `ADMIN` implementada em nenhuma tela ainda.

## Commits desta sessão

Histórico completo em `git log` no repositório `argus-sistema` (repo
próprio, separado da landing page, só local — sem remoto configurado).
Um commit por bloco de funcionalidade fechado, do setup inicial até
Cadastros/Mapas/Uso Digital/Configurações. Este commit de documentação
(`PROGRESS.md` + `DECISIONS.md`) fecha a prioridade 9 da sua lista.

## Próximos passos sugeridos (na ordem que eu faria)

1. Você revisar o sistema rodando local e decidir se publica já (nesse
   caso, só pedir — caminho conhecido, deploy rápido).
2. Decidir o storage de foto + fluxo de consentimento LGPD antes de
   qualquer colaborador real usar o check-in.
3. Substituir a análise de IA mock por uma chamada real (contrato já
   isolado em `src/lib/analiseIa.ts`).
4. Criar contas de login por colaborador (hoje só existe a admin).
