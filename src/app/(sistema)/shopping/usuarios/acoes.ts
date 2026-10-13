'use server';

import { randomInt } from 'crypto';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { encerrarSessoesDoUsuario, hashSenha, validarSenha } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirAbaAcao } from '@/lib/sessaoServidor';
import { abasValidas, PERFIS_MODELO } from '@/lib/shopping/permissoes';
import { adminsGeraisAtivos, loginEmUso, usuarioDaEmpresa } from '@/lib/usuarios';

export type Resultado = { ok: true; senhaProvisoria?: string } | { ok: false; erro: string };

export type DadosUsuario = { nome: string; username: string; senha?: string; email: string; telefone: string; abas: string[]; perfilModelo: string | null; adminGeral: boolean };

const LOGIN_VALIDO = /^[a-zA-Z0-9._-]{3,40}$/;

function limpar(d: DadosUsuario) {
  return {
    nome: d.nome.trim(),
    username: d.username.trim().toLowerCase(),
    email: d.email.trim() || null,
    telefone: d.telefone.trim() || null,
    abas: abasValidas(d.abas),
    perfilModelo: PERFIS_MODELO.some((p) => p.id === d.perfilModelo) ? d.perfilModelo : null,
    adminGeral: !!d.adminGeral,
  };
}

/** Senha provisória legível: 4 letras + 4 números (ex.: Kmrt-4821). */
function senhaProvisoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const l = Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join('');
  return `${l[0].toUpperCase()}${l.slice(1)}-${String(randomInt(1000, 10000))}`;
}

async function admin() {
  return exigirAbaAcao('usuarios');
}

export async function criarUsuario(d: DadosUsuario): Promise<Resultado> {
  const eu = await admin();
  const u = limpar(d);
  if (!u.nome) return { ok: false, erro: 'Informe o nome.' };
  if (!LOGIN_VALIDO.test(u.username)) return { ok: false, erro: 'Login com 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.' };
  if (await loginEmUso(u.username)) return { ok: false, erro: 'Esse login já está em uso.' };
  const problema = validarSenha(d.senha ?? '');
  if (problema) return { ok: false, erro: problema };
  if (u.email && !/^\S+@\S+\.\S+$/.test(u.email)) return { ok: false, erro: 'E-mail inválido.' };

  const [novo] = await sql<{ id: number }[]>`
    INSERT INTO usuarios (empresa_id, username, senha_hash, nome, role, email, telefone, abas, perfil_modelo, admin_geral, trocar_senha)
    VALUES (${eu.empresaId}, ${u.username}, ${await hashSenha(d.senha!)}, ${u.nome}, 'SHOPPING', ${u.email}, ${u.telefone}, ${u.abas}, ${u.perfilModelo}, ${u.adminGeral}, true)
    RETURNING id
  `;
  await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, alvoUsuarioId: novo.id, acao: 'usuario_criado', detalhes: { login: u.username, abas: u.abas, adminGeral: u.adminGeral } });
  revalidatePath('/shopping/usuarios');
  return { ok: true };
}

export async function editarUsuario(id: number, d: DadosUsuario): Promise<Resultado> {
  const eu = await admin();
  const atual = await usuarioDaEmpresa(eu.empresaId, id);
  if (!atual) return { ok: false, erro: 'Usuário não encontrado.' };
  const u = limpar(d);
  if (!u.nome) return { ok: false, erro: 'Informe o nome.' };
  if (!LOGIN_VALIDO.test(u.username)) return { ok: false, erro: 'Login com 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.' };
  if (await loginEmUso(u.username, id)) return { ok: false, erro: 'Esse login já está em uso.' };
  if (u.email && !/^\S+@\S+\.\S+$/.test(u.email)) return { ok: false, erro: 'E-mail inválido.' };
  if (atual.admin_geral && !u.adminGeral && (await adminsGeraisAtivos(eu.empresaId)) <= 1) return { ok: false, erro: 'Precisa sobrar pelo menos um administrador geral ativo.' };

  await sql`
    UPDATE usuarios SET nome = ${u.nome}, username = ${u.username}, email = ${u.email}, telefone = ${u.telefone},
      abas = ${u.abas}, perfil_modelo = ${u.perfilModelo}, admin_geral = ${u.adminGeral}
    WHERE id = ${id} AND empresa_id = ${eu.empresaId}
  `;
  const mudouPermissao = atual.admin_geral !== u.adminGeral || [...atual.abas].sort().join() !== [...u.abas].sort().join();
  await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, alvoUsuarioId: id, acao: 'usuario_editado', detalhes: { login: u.username } });
  if (mudouPermissao)
    await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, alvoUsuarioId: id, acao: 'permissoes_alteradas', detalhes: { antes: { abas: atual.abas, adminGeral: atual.admin_geral }, depois: { abas: u.abas, adminGeral: u.adminGeral } } });
  revalidatePath('/shopping/usuarios');
  return { ok: true };
}

export async function alterarAtivo(id: number, ativo: boolean): Promise<Resultado> {
  const eu = await admin();
  const atual = await usuarioDaEmpresa(eu.empresaId, id);
  if (!atual) return { ok: false, erro: 'Usuário não encontrado.' };
  if (!ativo && id === eu.id) return { ok: false, erro: 'Você não pode desativar o seu próprio usuário.' };
  if (!ativo && atual.admin_geral && (await adminsGeraisAtivos(eu.empresaId)) <= 1) return { ok: false, erro: 'Precisa sobrar pelo menos um administrador geral ativo.' };
  await sql`UPDATE usuarios SET ativo = ${ativo} WHERE id = ${id} AND empresa_id = ${eu.empresaId}`;
  if (!ativo) await encerrarSessoesDoUsuario(id);
  await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, alvoUsuarioId: id, acao: ativo ? 'usuario_reativado' : 'usuario_desativado' });
  revalidatePath('/shopping/usuarios');
  return { ok: true };
}

/** Gera uma senha provisória (mostrada uma vez) e obriga a troca no próximo acesso. */
export async function redefinirSenha(id: number): Promise<Resultado> {
  const eu = await admin();
  const atual = await usuarioDaEmpresa(eu.empresaId, id);
  if (!atual) return { ok: false, erro: 'Usuário não encontrado.' };
  const senha = senhaProvisoria();
  await sql`UPDATE usuarios SET senha_hash = ${await hashSenha(senha)}, trocar_senha = true, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ${id} AND empresa_id = ${eu.empresaId}`;
  await encerrarSessoesDoUsuario(id);
  await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, alvoUsuarioId: id, acao: 'senha_redefinida' });
  revalidatePath('/shopping/usuarios');
  return { ok: true, senhaProvisoria: senha };
}

export async function desbloquear(id: number): Promise<Resultado> {
  const eu = await admin();
  await sql`UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ${id} AND empresa_id = ${eu.empresaId}`;
  await registrarAuditoria({ empresaId: eu.empresaId, usuarioId: eu.id, alvoUsuarioId: id, acao: 'usuario_desbloqueado' });
  revalidatePath('/shopping/usuarios');
  return { ok: true };
}
