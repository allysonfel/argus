// Sai com código 0 (precisa semear) se a tabela empresas está vazia,
// ou 1 (já tem dado) caso contrário. Usado só no boot de produção, pra
// rodar o seed de exemplo uma única vez (na primeira subida com banco
// vazio) sem apagar dado real em reinícios seguintes.
import { sql } from '../src/lib/db';

async function main() {
  const [{ total }] = await sql<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM empresas`;
  await sql.end();
  process.exit(total > 0 ? 1 : 0);
}

main();
