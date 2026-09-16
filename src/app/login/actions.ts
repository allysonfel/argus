'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar, criarSessao, destruirSessao } from '@/lib/auth';
import { COOKIE_SESSAO } from '@/lib/sessaoServidor';

export async function fazerLogin(_prevState: { erro: string | null }, formData: FormData): Promise<{ erro: string | null }> {
  const username = String(formData.get('username') ?? '').trim();
  const senha = String(formData.get('senha') ?? '');

  if (!username || !senha) {
    return { erro: 'Preencha usuário e senha.' };
  }

  const usuario = await autenticar(username, senha);
  if (!usuario) {
    return { erro: 'Usuário ou senha incorretos.' };
  }

  const token = await criarSessao(usuario.id);
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/');
}

export async function fazerLogout(): Promise<void> {
  'use server';
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await destruirSessao(token);
  jar.delete(COOKIE_SESSAO);
  redirect('/login');
}
