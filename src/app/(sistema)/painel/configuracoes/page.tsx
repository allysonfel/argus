import { exigirSessao } from '@/lib/sessaoServidor';
import { obterCriterios } from '@/lib/configuracoes';
import { sql } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { salvarCriteriosAction } from './actions';

function Checkbox({ nome, rotulo, marcado }: { nome: string; rotulo: string; marcado: boolean }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-on-surface">
      <input type="checkbox" name={nome} defaultChecked={marcado} className="h-4 w-4 rounded-sm border-outline-variant text-primary focus:ring-primary/30" />
      {rotulo}
    </label>
  );
}

export default async function ConfiguracoesPage() {
  const sessao = await exigirSessao();
  const [criterios, empresas] = await Promise.all([
    obterCriterios(sessao.empresaId),
    sql<{ nome: string; cnpj: string | null; chave_api: string | null }[]>`SELECT nome, cnpj, chave_api FROM empresas WHERE id = ${sessao.empresaId}`,
  ]);
  const empresa = empresas[0];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Configurações</h1>
      <p className="mb-6 text-sm text-on-surface-variant">Critérios do Ponto IA e limiares que disparam alertas no dashboard.</p>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-on-surface">Dados da empresa</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Nome</p>
            <p className="text-sm text-on-surface">{empresa?.nome}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">CNPJ</p>
            <p className="text-sm text-on-surface">{empresa?.cnpj ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Chave de API (agente de Uso Digital)</p>
            <p className="break-all rounded-sm bg-surface-container-low px-2 py-1.5 font-mono text-xs text-on-surface">{empresa?.chave_api ?? '—'}</p>
          </div>
        </div>
      </Card>

      <form action={salvarCriteriosAction}>
        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold text-on-surface">Critérios do Ponto IA</h2>
          <p className="mb-4 text-xs text-on-surface-variant">
            O registro de ponto nunca é bloqueado — esses critérios só definem o que a análise de IA verifica; o resultado fica visível pra gestão no Cartão
            Ponto, nunca pro colaborador na hora.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Checkbox nome="verificar_rosto" rotulo="Rosto" marcado={criterios.verificar_rosto} />
            <Checkbox nome="verificar_uniforme" rotulo="Uniforme" marcado={criterios.verificar_uniforme} />
            <Checkbox nome="verificar_cracha" rotulo="Crachá" marcado={criterios.verificar_cracha} />
            <Checkbox nome="verificar_calcado" rotulo="Calçado de segurança" marcado={criterios.verificar_calcado} />
          </div>
          <Field
            label="Raio de geolocalização aceito (metros)"
            name="raio_geolocalizacao_metros"
            type="number"
            defaultValue={criterios.raio_geolocalizacao_metros}
            className="mt-4 max-w-xs"
          />
        </Card>

        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold text-on-surface">Limiares de alerta</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Atraso considerado (minutos)" name="limiar_atraso_minutos" type="number" defaultValue={criterios.limiar_atraso_minutos} />
            <Field label="Ociosidade considerada (minutos)" name="limiar_ociosidade_minutos" type="number" defaultValue={criterios.limiar_ociosidade_minutos} />
            <Field
              label="Cartão sem assinatura vira alerta após (dias)"
              name="limiar_cartao_sem_assinatura_dias"
              type="number"
              defaultValue={criterios.limiar_cartao_sem_assinatura_dias}
            />
            <Field
              label="Ajuste pendente vira alerta após (dias)"
              name="limiar_ajuste_pendente_dias"
              type="number"
              defaultValue={criterios.limiar_ajuste_pendente_dias}
            />
          </div>
        </Card>

        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold text-on-surface">Banco de horas</h2>
          <Field
            label="Percentual de hora extra padrão (%)"
            name="percentual_hora_extra_padrao"
            type="number"
            defaultValue={criterios.percentual_hora_extra_padrao}
            className="max-w-xs"
          />
        </Card>

        <Button type="submit">Salvar configurações</Button>
      </form>
    </div>
  );
}
