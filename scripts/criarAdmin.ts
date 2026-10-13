// Cria o PRIMEIRO administrador geral de uma instalação. Lê do ambiente:
//   ARGUS_ADMIN_USUARIO  (login, obrigatório)
//   ARGUS_ADMIN_SENHA    (senha provisória, obrigatória; troca obrigatória no 1º acesso)
//   ARGUS_ADMIN_NOME     (opcional, padrão "Administrador")
//   ARGUS_EMPRESA_ID     (opcional, padrão: a primeira empresa)
// Não faz nada se o login já existir (seguro rodar em todo boot).
//
//   npm run admin:criar
import { sql } from '../src/lib/db';
import { hashSenha, validarSenha } from '../src/lib/auth';

async function main() {
  const usuario = process.env.ARGUS_ADMIN_USUARIO?.trim().toLowerCase();
  const senha = process.env.ARGUS_ADMIN_SENHA ?? '';
  const nome = process.env.ARGUS_ADMIN_NOME?.trim() || 'Administrador';
  if (!usuario || !senha) {
    console.log('[admin] ARGUS_ADMIN_USUARIO/ARGUS_ADMIN_SENHA não definidos, nada a fazer.');
    return;
  }
  const problema = validarSenha(senha);
  if (problema) throw new Error(`[admin] senha fraca: ${problema}`);

  const [existe] = await sql<{ id: number }[]>`SELECT id FROM usuarios WHERE lower(username) = ${usuario}`;
  if (existe) {
    console.log(`[admin] "${usuario}" já existe, nada a fazer.`);
    return;
  }
  const empresaId = Number(process.env.ARGUS_EMPRESA_ID) || (await sql<{ id: number }[]>`SELECT id FROM empresas ORDER BY id LIMIT 1`)[0]?.id;
  if (!empresaId) throw new Error('[admin] nenhuma empresa cadastrada.');
  await sql`
    INSERT INTO usuarios (empresa_id, username, senha_hash, nome, role, admin_geral, trocar_senha)
    VALUES (${empresaId}, ${usuario}, ${await hashSenha(senha)}, ${nome}, 'ADMIN', true, true)
  `;
  console.log(`[admin] administrador geral "${usuario}" criado (troca de senha no primeiro acesso).`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
