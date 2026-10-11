'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirSessao } from '@/lib/sessaoServidor';
import { criarUnidade, criarDepartamento, criarColaborador, criarDispositivo, atualizarStatusColaborador } from '@/lib/cadastros';
import type { StatusColaborador } from '@/lib/tipos';

export async function criarUnidadeAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  await criarUnidade(sessao.empresaId, {
    nome: String(formData.get('nome') ?? '').trim(),
    cidade: String(formData.get('cidade') ?? '').trim(),
    estado: String(formData.get('estado') ?? '').trim(),
  });
  revalidatePath('/painel/cadastros/unidades');
}

export async function criarDepartamentoAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const unidadeId = formData.get('unidadeId') ? Number(formData.get('unidadeId')) : null;
  await criarDepartamento(sessao.empresaId, { nome: String(formData.get('nome') ?? '').trim(), unidadeId });
  revalidatePath('/painel/cadastros/departamentos');
}

export async function criarColaboradorAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  await criarColaborador(sessao.empresaId, {
    nome: String(formData.get('nome') ?? '').trim(),
    cargo: String(formData.get('cargo') ?? '').trim(),
    cpf: String(formData.get('cpf') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    telefone: String(formData.get('telefone') ?? '').trim(),
    unidadeId: formData.get('unidadeId') ? Number(formData.get('unidadeId')) : null,
    departamentoId: formData.get('departamentoId') ? Number(formData.get('departamentoId')) : null,
    dataAdmissao: String(formData.get('dataAdmissao') ?? ''),
    jornadaSemanalHoras: Number(formData.get('jornadaSemanalHoras') ?? 44),
    horarioEntradaPadrao: String(formData.get('horarioEntradaPadrao') ?? '08:00'),
    horarioSaidaPadrao: String(formData.get('horarioSaidaPadrao') ?? '18:00'),
  });
  revalidatePath('/painel/cadastros/colaboradores');
  redirect('/painel/cadastros/colaboradores');
}

export async function atualizarStatusColaboradorAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const id = Number(formData.get('id'));
  const status = String(formData.get('status')) as StatusColaborador;
  await atualizarStatusColaborador(sessao.empresaId, id, status);
  revalidatePath('/painel/cadastros/colaboradores');
}

export async function criarDispositivoAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  await criarDispositivo(sessao.empresaId, {
    nome: String(formData.get('nome') ?? '').trim(),
    tipo: String(formData.get('tipo')) as 'notebook' | 'celular',
    identificador: String(formData.get('identificador') ?? '').trim(),
    colaboradorId: formData.get('colaboradorId') ? Number(formData.get('colaboradorId')) : null,
    unidadeId: formData.get('unidadeId') ? Number(formData.get('unidadeId')) : null,
  });
  revalidatePath('/painel/cadastros/dispositivos');
  redirect('/painel/cadastros/dispositivos');
}
