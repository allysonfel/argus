'use server';

import { revalidatePath } from 'next/cache';
import { exigirSessao } from '@/lib/sessaoServidor';
import { atualizarCriterios } from '@/lib/configuracoes';

export async function salvarCriteriosAction(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();

  await atualizarCriterios(sessao.empresaId, {
    verificar_rosto: formData.get('verificar_rosto') === 'on',
    verificar_uniforme: formData.get('verificar_uniforme') === 'on',
    verificar_cracha: formData.get('verificar_cracha') === 'on',
    verificar_calcado: formData.get('verificar_calcado') === 'on',
    raio_geolocalizacao_metros: Number(formData.get('raio_geolocalizacao_metros')),
    limiar_atraso_minutos: Number(formData.get('limiar_atraso_minutos')),
    limiar_ociosidade_minutos: Number(formData.get('limiar_ociosidade_minutos')),
    limiar_cartao_sem_assinatura_dias: Number(formData.get('limiar_cartao_sem_assinatura_dias')),
    limiar_ajuste_pendente_dias: Number(formData.get('limiar_ajuste_pendente_dias')),
    percentual_hora_extra_padrao: Number(formData.get('percentual_hora_extra_padrao')),
  });

  revalidatePath('/painel/configuracoes');
  revalidatePath('/painel');
}
