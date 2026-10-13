'use server';

import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { hashSenha, validarSenha, verificarSenha } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { destinoInicial, getSessaoAtual } from '@/lib/sessaoServidor';

export async function trocarSenha(_prev: { erro: string | null }, formData: FormData): Promise<{ erro: string | null }> {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect('/login');
  const atual = String(formData.get('atual') ?? '');
  const nova = String(formData.get('nova') ?? '');
  const confirmar = String(formData.get('confirmar') ?? '');

  const [u] = await sql<{ senha_hash: string }[]>`SELECT senha_hash FROM usuarios WHERE id = ${sessao.id}`;
  if (!u || !(await verificarSenha(atual, u.senha_hash))) return { erro: 'A senha atual não confere.' };
  const problema = validarSenha(nova);
  if (problema) return { erro: problema };
  if (nova !== confirmar) return { erro: 'A confirmação não é igual à senha nova.' };
  if (nova === atual) return { erro: 'A senha nova precisa ser diferente da atual.' };

  await sql`UPDATE usuarios SET senha_hash = ${await hashSenha(nova)}, trocar_senha = false WHERE id = ${sessao.id}`;
  await registrarAuditoria({ empresaId: sessao.empresaId, usuarioId: sessao.id, alvoUsuarioId: sessao.id, acao: 'senha_trocada' });
  redirect(destinoInicial({ ...sessao, trocarSenha: false }));
}
