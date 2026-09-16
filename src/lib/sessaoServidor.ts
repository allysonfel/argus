import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { obterSessao, type UsuarioSessao } from './auth';

export const COOKIE_SESSAO = 'argus_sessao';

/** Lê a sessão atual (Server Component / Route Handler) — null se não logado. */
export async function getSessaoAtual(): Promise<UsuarioSessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  return obterSessao(token);
}

/** Usado no topo de toda página /admin — manda pro login se não houver sessão. */
export async function exigirSessao(): Promise<UsuarioSessao> {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect('/login');
  return sessao;
}

/** Idem, mas só ADMIN (telas de Configurações/cadastro). */
export async function exigirAdmin(): Promise<UsuarioSessao> {
  const sessao = await exigirSessao();
  if (sessao.role !== 'ADMIN') redirect('/');
  return sessao;
}
