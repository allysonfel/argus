import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { obterSessao, type UsuarioSessao } from './auth';
import { podeVer, primeiraRota, type AbaId } from './shopping/permissoes';

export const COOKIE_SESSAO = 'argus_sessao';

/** Lê a sessão atual (Server Component / Route Handler) — null se não logado. */
export async function getSessaoAtual(): Promise<UsuarioSessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  return obterSessao(token);
}

/** Topo de toda página logada: sem sessão vai pro login; com troca de senha pendente, pra tela de troca. */
export async function exigirSessao(): Promise<UsuarioSessao> {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect('/login');
  if (sessao.trocarSenha) redirect('/trocar-senha');
  return sessao;
}

/** Idem, mas só ADMIN (telas de Configurações/cadastro do painel de ponto). */
export async function exigirAdmin(): Promise<UsuarioSessao> {
  const sessao = await exigirSessao();
  if (sessao.role !== 'ADMIN') redirect('/painel');
  return sessao;
}

/** Para onde mandar o usuário logado (depois do login, ou quando abre algo sem permissão). */
export function destinoInicial(sessao: UsuarioSessao): string {
  if (sessao.trocarSenha) return '/trocar-senha';
  const rota = primeiraRota(sessao);
  if (rota) return rota;
  if (sessao.role === 'ADMIN' || sessao.role === 'GESTOR') return '/painel';
  return '/sem-acesso';
}

/** Página de uma aba do shopping: bloqueia no servidor quem não tem a aba. */
export async function exigirAba(aba: AbaId): Promise<UsuarioSessao> {
  const sessao = await exigirSessao();
  if (!podeVer(sessao, aba)) {
    const destino = destinoInicial(sessao);
    redirect(destino.startsWith('/shopping') || destino === '/painel' ? destino : '/sem-acesso');
  }
  return sessao;
}

/** Ações do servidor (server actions): erro em vez de redirecionar. */
export async function exigirAbaAcao(aba: AbaId): Promise<UsuarioSessao> {
  const sessao = await getSessaoAtual();
  if (!sessao || sessao.trocarSenha) throw new Error('Sessão expirada. Entre de novo.');
  if (!podeVer(sessao, aba)) throw new Error('Sem permissão para esta função.');
  return sessao;
}

export async function exigirAdminGeral(): Promise<UsuarioSessao> {
  return exigirAba('usuarios');
}
