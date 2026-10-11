'use server';

import { revalidatePath } from 'next/cache';
import { exigirSessao } from '@/lib/sessaoServidor';
import { solicitarAjuste, decidirAjuste } from '@/lib/ajustes';
import { assinarPeriodo } from '@/lib/assinaturas';
import { decidirSolicitacao } from '@/lib/eventosPessoas';
import type { TipoMarcacao } from '@/lib/tipos';

export async function criarAjusteAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const colaboradorId = Number(formData.get('colaboradorId'));
  const tipoAjuste = String(formData.get('tipoAjuste')) as 'inclusao' | 'correcao' | 'exclusao_justificada';
  const tipoMarcacao = (formData.get('tipoMarcacao') as TipoMarcacao) || null;
  const registroPontoId = formData.get('registroPontoId') ? Number(formData.get('registroPontoId')) : null;
  const data = String(formData.get('data'));
  const hora = String(formData.get('hora'));
  const justificativa = String(formData.get('justificativa') ?? '').trim();

  if (!colaboradorId || !data || !hora || !justificativa) return;

  await solicitarAjuste({
    empresaId: sessao.empresaId,
    colaboradorId,
    registroPontoId,
    tipoAjuste,
    tipoMarcacao,
    horarioOriginal: null,
    horarioAjustado: `${data}T${hora}:00`,
    justificativa,
    solicitadoPor: sessao.id,
  });

  revalidatePath(`/painel/ponto/${colaboradorId}`);
  revalidatePath('/painel/ponto/pendencias');
  revalidatePath('/painel');
}

export async function decidirAjusteAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const ajusteId = Number(formData.get('ajusteId'));
  const decisao = String(formData.get('decisao')) as 'aprovado' | 'rejeitado';
  const colaboradorId = Number(formData.get('colaboradorId'));

  await decidirAjuste(sessao.empresaId, ajusteId, decisao, sessao.id);

  revalidatePath('/painel/ponto/pendencias');
  revalidatePath(`/painel/ponto/${colaboradorId}`);
  revalidatePath('/painel');
}

export async function assinarPeriodoAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const assinaturaId = Number(formData.get('assinaturaId'));
  const colaboradorId = Number(formData.get('colaboradorId'));

  await assinarPeriodo(sessao.empresaId, assinaturaId);

  revalidatePath('/painel/ponto/pendencias');
  revalidatePath(`/painel/ponto/${colaboradorId}`);
  revalidatePath('/painel');
}

export async function decidirSolicitacaoAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const eventoId = Number(formData.get('eventoId'));
  const decisao = String(formData.get('decisao')) as 'aprovado' | 'rejeitado';

  await decidirSolicitacao(sessao.empresaId, eventoId, decisao);

  revalidatePath('/painel/ponto/pendencias');
  revalidatePath('/painel');
}
