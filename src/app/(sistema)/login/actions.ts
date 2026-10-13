'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar, criarSessao, destruirSessao, obterSessao } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { COOKIE_SESSAO, destinoInicial } from '@/lib/sessaoServidor';

export async function fazerLogin(_prevState: { erro: string | null }, formData: FormData): Promise<{ erro: string | null }> {
  const username = String(formData.get('username') ?? '').trim();
  const senha = String(formData.get('senha') ?? '');

  if (!username || !senha) {
    return { erro: 'Preencha usuário e senha.' };
  }

  const r = await autenticar(username, senha);
  if (!r.ok) {
    if (r.usuarioId) await registrarAuditoria({ empresaId: r.empresaId ?? null, usuarioId: r.usuarioId, acao: r.bloqueou ? 'login_bloqueado' : 'login_falhou' });
    return { erro: r.erro };
  }

  const { token, segundos } = await criarSessao(r.usuario.id, r.usuario.empresaId);
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: segundos,
  });
  await registrarAuditoria({ empresaId: r.usuario.empresaId, usuarioId: r.usuario.id, acao: 'login' });

  redirect(destinoInicial(r.usuario));
}

export async function fazerLogout(): Promise<void> {
  'use server';
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) {
    const sessao = await obterSessao(token);
    if (sessao) await registrarAuditoria({ empresaId: sessao.empresaId, usuarioId: sessao.id, acao: 'logout' });
    await destruirSessao(token);
  }
  jar.delete(COOKIE_SESSAO);
  redirect('/login');
}
