# Argus — Logos Company

Sistema de gestão de operação (ponto eletrônico com IA, rastreio de
dispositivos, uso digital e alertas), multi-tenant, para clientes da
Logos Company.

## Stack

Next.js (App Router) + TypeScript + PostgreSQL (lib `postgres`, sem
ORM) + Tailwind CSS v4 — mesma stack do outro produto Logos
(logoscompany), reaproveitada por decisão do briefing.

## Rodando local

```bash
cp .env.example .env.local   # ajuste DATABASE_URL
npm install
npm run db:migrate           # aplica db/schema.sql (idempotente)
npm run db:seed              # popula dados de exemplo (empresa "Construtora Nordeste Ltda")
npm run dev
```

Login de exemplo após o seed: usuário `admin`, senha `argus2026`.

## Documentação

- `PROGRESS.md` — o que foi feito, o que falta, o que foi pulado e por quê.
- `DECISIONS.md` — decisões de produto/arquitetura não especificadas no
  briefing original, e o motivo de cada uma.
