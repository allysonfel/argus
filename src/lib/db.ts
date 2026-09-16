import postgres from 'postgres';

// Cliente único reaproveitado entre chamadas (mesmo padrão do outro
// produto Logos — ver logoscompany/src/lib/db.ts). Diferente daquele
// projeto (uma tabela só, ensureSchema() inline), o schema aqui é grande
// e interrelacionado — ver db/schema.sql + scripts/migrate.ts em vez de
// criar tabela por módulo (ver DECISIONS.md).
const url = process.env.DATABASE_URL ?? '';
const semSsl = url.includes('railway.internal') || url.includes('localhost') || url.includes('127.0.0.1');

export const sql = postgres(url, {
  ssl: semSsl ? false : 'require',
});
