import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { sql } from './db';
import { obterConfiguracoes } from './shopping/configuracoes';

// Sessão própria (cookie httpOnly + tabela `sessoes`) — a stack
// reaproveitada do outro produto Logos não inclui NextAuth, então em vez
// de puxar uma dependência de framework de auth pra um app novo, uso o
// primitivo mais simples que resolve: token aleatório, guardado no banco,
// comparado a cada request. Ver DECISIONS.md.

// SHOPPING = usuário criado no módulo de usuários do shopping (não vê o painel de ponto).
export type Role = 'ADMIN' | 'GESTOR' | 'COLABORADOR' | 'SHOPPING';

export type UsuarioSessao = {
  id: number;
  empresaId: number;
  empresaNome: string;
  colaboradorId: number | null;
  username: string;
  nome: string;
  role: Role;
  adminGeral: boolean;
  abas: string[];
  trocarSenha: boolean;
};

const BCRYPT_CUSTO = 12;
export const SENHA_MINIMA = 8;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, BCRYPT_CUSTO);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/** Problema da senha nova, ou null se serve. */
export function validarSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
  return null;
}

type LinhaUsuario = {
  id: number;
  empresa_id: number;
  empresa_nome: string;
  colaborador_id: number | null;
  username: string;
  nome: string;
  role: Role;
  admin_geral: boolean;
  abas: string[];
  trocar_senha: boolean;
};

function paraSessao(u: LinhaUsuario): UsuarioSessao {
  return {
    id: u.id,
    empresaId: u.empresa_id,
    empresaNome: u.empresa_nome,
    colaboradorId: u.colaborador_id,
    username: u.username,
    nome: u.nome,
    role: u.role,
    adminGeral: u.admin_geral,
    abas: u.abas ?? [],
    trocarSenha: u.trocar_senha,
  };
}

export type ResultadoLogin = { ok: true; usuario: UsuarioSessao } | { ok: false; erro: string; usuarioId?: number; empresaId?: number; bloqueou?: boolean };

/** Confere login e senha, com bloqueio temporário depois de várias tentativas erradas. */
export async function autenticar(username: string, senha: string): Promise<ResultadoLogin> {
  const rows = await sql<(LinhaUsuario & { senha_hash: string; tentativas_falhas: number; bloqueado_ate: Date | null })[]>`
    SELECT u.id, u.empresa_id, e.nome AS empresa_nome, u.colaborador_id, u.username, u.senha_hash, u.nome, u.role,
           u.admin_geral, u.abas, u.trocar_senha, u.tentativas_falhas, u.bloqueado_ate
    FROM usuarios u
    JOIN empresas e ON e.id = u.empresa_id
    WHERE lower(u.username) = lower(${username}) AND u.ativo = true AND e.ativo = true
  `;
  const u = rows[0];
  if (!u) return { ok: false, erro: 'Usuário ou senha incorretos.' };

  if (u.bloqueado_ate && u.bloqueado_ate.getTime() > Date.now()) {
    const min = Math.ceil((u.bloqueado_ate.getTime() - Date.now()) / 60000);
    return { ok: false, erro: `Muitas tentativas erradas. Tente de novo em ${min} min.`, usuarioId: u.id, empresaId: u.empresa_id };
  }

  if (!(await verificarSenha(senha, u.senha_hash))) {
    const cfg = await obterConfiguracoes(u.empresa_id);
    const tentativas = u.tentativas_falhas + 1;
    if (tentativas >= cfg.max_tentativas) {
      await sql`UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = now() + make_interval(mins => ${cfg.bloqueio_minutos}) WHERE id = ${u.id}`;
      return { ok: false, erro: `Muitas tentativas erradas. Acesso bloqueado por ${cfg.bloqueio_minutos} min.`, usuarioId: u.id, empresaId: u.empresa_id, bloqueou: true };
    }
    await sql`UPDATE usuarios SET tentativas_falhas = ${tentativas} WHERE id = ${u.id}`;
    return { ok: false, erro: 'Usuário ou senha incorretos.', usuarioId: u.id, empresaId: u.empresa_id };
  }

  await sql`UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL, ultimo_acesso = now() WHERE id = ${u.id}`;
  return { ok: true, usuario: paraSessao(u) };
}

/** Cria a sessão com a duração das configurações do shopping. Devolve o token e quantos segundos vale. */
export async function criarSessao(usuarioId: number, empresaId: number): Promise<{ token: string; segundos: number }> {
  const cfg = await obterConfiguracoes(empresaId);
  const segundos = Math.max(1, cfg.sessao_horas) * 3600;
  const token = randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + segundos * 1000);
  await sql`INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (${token}, ${usuarioId}, ${expiraEm})`;
  return { token, segundos };
}

export async function obterSessao(token: string | undefined): Promise<UsuarioSessao | null> {
  if (!token) return null;
  const rows = await sql<LinhaUsuario[]>`
    SELECT u.id, u.empresa_id, e.nome AS empresa_nome, u.colaborador_id, u.username, u.nome, u.role,
           u.admin_geral, u.abas, u.trocar_senha
    FROM sessoes s
    JOIN usuarios u ON u.id = s.usuario_id
    JOIN empresas e ON e.id = u.empresa_id
    WHERE s.token = ${token} AND s.expira_em > now() AND u.ativo = true
  `;
  return rows[0] ? paraSessao(rows[0]) : null;
}

export async function destruirSessao(token: string): Promise<void> {
  await sql`DELETE FROM sessoes WHERE token = ${token}`;
}

/** Derruba todas as sessões de um usuário (desativado ou senha redefinida). */
export async function encerrarSessoesDoUsuario(usuarioId: number): Promise<void> {
  await sql`DELETE FROM sessoes WHERE usuario_id = ${usuarioId}`;
}
