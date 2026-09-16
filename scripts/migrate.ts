// Roda db/schema.sql inteiro contra o DATABASE_URL atual. Idempotente
// (tudo é CREATE TABLE/INDEX IF NOT EXISTS) — seguro rodar de novo.
import { readFileSync } from 'fs';
import { join } from 'path';
import { sql } from '../src/lib/db';

async function main() {
  const caminho = join(__dirname, '..', 'db', 'schema.sql');
  const script = readFileSync(caminho, 'utf-8');
  console.log('Aplicando db/schema.sql...');
  await sql.unsafe(script);
  console.log('Schema aplicado com sucesso.');
  await sql.end();
}

main().catch((e) => {
  console.error('Falha ao migrar:', e);
  process.exit(1);
});
