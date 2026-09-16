import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { sql } from './db';

// Sessão própria (cookie httpOnly + tabela `sessoes`) — a stack
// reaproveitada do outro produto Logos não inclui NextAuth, então em vez
// de puxar uma dependência de framework de auth pra um app novo, uso o
// primitivo mais simples que resolve: token aleatório, guardado no banco,
// comparado a cada request. Ver DECISIONS.md.

export type Role = 'ADMIN' | 'GESTOR' | 'COLABORADOR';

export type UsuarioSessao = {
  id: number;
  empresaId: number;
  empresaNome: string;
  colaboradorId: number | null;
  username: string;
  nome: string;
  role: Role;
};

const DURACAO_SESSAO_DIAS = 30;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export async function autenticar(username: string, senha: string): Promise<UsuarioSessao | null> {
  const rows = await sql<
    { id: number; empresa_id: number; empresa_nome: string; colaborador_id: number | null; username: string; senha_hash: string; nome: string; role: Role }[]
  >`
    SELECT u.id, u.empresa_id, e.nome AS empresa_nome, u.colaborador_id, u.username, u.senha_hash, u.nome, u.role
    FROM usuarios u
    JOIN empresas e ON e.id = u.empresa_id
    WHERE lower(u.username) = lower(${username}) AND u.ativo = true AND e.ativo = true
  `;
  const usuario = rows[0];
  if (!usuario) return null;

  const senhaOk = await verificarSenha(senha, usuario.senha_hash);
  if (!senhaOk) return null;

  return {
    id: usuario.id,
    empresaId: usuario.empresa_id,
    empresaNome: usuario.empresa_nome,
    colaboradorId: usuario.colaborador_id,
    username: usuario.username,
    nome: usuario.nome,
    role: usuario.role,
  };
}

export async function criarSessao(usuarioId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_DIAS * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (${token}, ${usuarioId}, ${expiraEm})`;
  return token;
}

export async function obterSessao(token: string | undefined): Promise<UsuarioSessao | null> {
  if (!token) return null;

  const rows = await sql<
    { id: number; empresa_id: number; empresa_nome: string; colaborador_id: number | null; username: string; nome: string; role: Role }[]
  >`
    SELECT u.id, u.empresa_id, e.nome AS empresa_nome, u.colaborador_id, u.username, u.nome, u.role
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    JOIN empresas e ON e.id = u.empresa_id
    WHERE s.token = ${token} AND s.expira_em > now() AND u.ativo = true
  `;
  const usuario = rows[0];
  if (!usuario) return null;

  return {
    id: usuario.id,
    empresaId: usuario.empresa_id,
    empresaNome: usuario.empresa_nome,
    colaboradorId: usuario.colaborador_id,
    username: usuario.username,
    nome: usuario.nome,
    role: usuario.role,
  };
}

export async function destruirSessao(token: string): Promise<void> {
  await sql`DELETE FROM sessoes WHERE token = ${token}`;
}
