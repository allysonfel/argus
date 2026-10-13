import { TituloPagina } from '@/components/shopping/Comum';
import { exigirAba } from '@/lib/sessaoServidor';
import { obterConfiguracoes } from '@/lib/shopping/configuracoes';
import { FormConfiguracoes } from './FormConfiguracoes';

export default async function ConfiguracoesPage() {
  const sessao = await exigirAba('configuracoes');
  const { empresa_id: _e, atualizado_em, ...campos } = await obterConfiguracoes(sessao.empresaId);
  return (
    <div>
      <TituloPagina titulo="Configurações" descricao={`Só o administrador geral vê esta tela. Última alteração: ${atualizado_em.toLocaleString('pt-BR', { timeZone: campos.fuso, dateStyle: 'short', timeStyle: 'short' })}.`} />
      <FormConfiguracoes inicial={{ ...campos, deteccao_confianca: Number(campos.deteccao_confianca), deteccao_fps: Number(campos.deteccao_fps) }} />
    </div>
  );
}
