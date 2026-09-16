#!/bin/sh
set -e

echo "[boot] aplicando schema..."
npm run db:migrate

if npx tsx scripts/seedSeNecessario.ts; then
  echo "[boot] banco vazio, rodando seed de exemplo..."
  npm run db:seed
else
  echo "[boot] banco já tem dado, pulando seed."
fi

echo "[boot] iniciando servidor..."
exec npx next start -p "${PORT:-8080}"
