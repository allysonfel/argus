import { sql } from './db';

// Usuários do shopping (tela Usuários). Nunca exclui: desativa, pra manter
// o histórico da auditoria.

export type UsuarioLista = {
  id: number;
  nome: string;
  username: string;
  email: string | null;
  telefone: string | null;
  role: string;
  admin_geral: boolean;
  abas: string[];
  perfil_modelo: string | null;
  ativo: boolean;
  trocar_senha: boolean;
  bloqueado_ate: Date | null;
  ultimo_acesso: Date | null;
  criado_em: Date;
};

export async function listarUsuarios(empresaId: number): Promise<UsuarioLista[]> {
  return sql<UsuarioLista[]>`
    SELECT id, nome, username, email, telefone, role, admin_geral, abas, perfil_modelo, ativo, trocar_senha, bloqueado_ate, ultimo_acesso, criado_em
    FROM usuarios WHERE empresa_id = ${empresaId}
    ORDER BY ativo DESC, admin_geral DESC, nome
  `;
}

export async function usuarioDaEmpresa(empresaId: number, id: number): Promise<UsuarioLista | null> {
  const [u] = await sql<UsuarioLista[]>`
    SELECT id, nome, username, email, telefone, role, admin_geral, abas, perfil_modelo, ativo, trocar_senha, bloqueado_ate, ultimo_acesso, criado_em
    FROM usuarios WHERE empresa_id = ${empresaId} AND id = ${id}
  `;
  return u ?? null;
}

/** Login já usado em qualquer empresa (o login é procurado sem a empresa). */
export async function loginEmUso(username: string, excetoId?: number): Promise<boolean> {
  const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM usuarios WHERE lower(username) = lower(${username}) AND id <> ${excetoId ?? 0}`;
  return r.n > 0;
}

export async function adminsGeraisAtivos(empresaId: number): Promise<number> {
  const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM usuarios WHERE empresa_id = ${empresaId} AND admin_geral AND ativo`;
  return r.n;
}
