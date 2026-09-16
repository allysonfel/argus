import { exigirSessao } from '@/lib/sessaoServidor';
import { listarColaboradores } from '@/lib/cadastros';
import {
  resumoUsoDigital,
  topColaboradoresAtividade,
  distribuicaoPorColaborador,
  distribuicaoPorUnidade,
  distribuicaoPorDepartamento,
  mediaCliquesPorUnidade,
  evolucaoSemanalColaborador,
  colaboradoresOfensores,
} from '@/lib/usoDigital';
import { diasAtrasISO, hojeISO } from '@/lib/datas';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SelectField, Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { UsoDigitalCharts } from './UsoDigitalCharts';

export default async function UsoDigitalPage({ searchParams }: { searchParams: Promise<{ inicio?: string; fim?: string; colaboradorId?: string }> }) {
  const sessao = await exigirSessao();
  const sp = await searchParams;
  const inicio = sp.inicio || diasAtrasISO(30);
  const fim = sp.fim || hojeISO();

  const colaboradores = await listarColaboradores(sessao.empresaId, { status: 'ativo' });
  const colaboradorId = Number(sp.colaboradorId) || colaboradores[0]?.id;

  const [resumo, top5, porColaborador, porUnidade, porDepartamento, mediaPorUnidade, evolucaoSemanal, ofensores] = await Promise.all([
    resumoUsoDigital(sessao.empresaId, inicio, fim),
    topColaboradoresAtividade(sessao.empresaId, inicio, fim, 5),
    distribuicaoPorColaborador(sessao.empresaId, inicio, fim),
    distribuicaoPorUnidade(sessao.empresaId, inicio, fim),
    distribuicaoPorDepartamento(sessao.empresaId, inicio, fim),
    mediaCliquesPorUnidade(sessao.empresaId, inicio, fim),
    colaboradorId ? evolucaoSemanalColaborador(sessao.empresaId, colaboradorId, 6) : Promise.resolve([]),
    colaboradoresOfensores(sessao.empresaId, 14, 8),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Uso Digital</h1>
      <p className="mb-4 text-sm text-on-surface-variant">Atividade digital dos colaboradores monitorados pelo agente de desktop.</p>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="De" type="date" name="inicio" defaultValue={inicio} className="w-40" />
        <Field label="Até" type="date" name="fim" defaultValue={fim} className="w-40" />
        <SelectField label="Colaborador (evolução semanal)" name="colaboradorId" defaultValue={colaboradorId} className="w-56">
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Funcionários monitorados" value={resumo.funcionariosMonitorados} />
        <StatCard label="Cliques totais" value={resumo.cliquesTotais.toLocaleString('pt-BR')} tone="primary" />
        <StatCard label="Média por funcionário" value={resumo.mediaPorFuncionario.toLocaleString('pt-BR')} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-on-surface">Top 5 mais ativos</h2>
          <ol className="flex flex-col gap-3">
            {top5.map((t, i) => (
              <li key={t.colaborador_id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                    {i + 1}
                  </span>
                  {t.nome}
                </span>
                <span className="font-semibold text-on-surface">{Number(t.cliques).toLocaleString('pt-BR')}</span>
              </li>
            ))}
            {top5.length === 0 && <p className="text-sm text-on-surface-variant">Sem dados no período.</p>}
          </ol>
        </Card>

        <Card>
          <h2 className="mb-1 text-base font-semibold text-on-surface">Colaboradores ofensores</h2>
          <p className="mb-4 text-xs text-on-surface-variant">Menor média diária de atividade (14 dias) — possível ociosidade.</p>
          <ul className="flex flex-col gap-2.5">
            {ofensores.map((o) => (
              <li key={o.colaborador_id} className="flex items-center justify-between text-sm">
                <span className="text-on-surface">{o.nome}</span>
                <Badge variant={o.media_diaria < 5 ? 'error' : 'neutral'}>{o.media_diaria}/dia</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <UsoDigitalCharts
        porColaborador={porColaborador.map((r) => ({ nome: r.nome, cliques: Number(r.cliques) }))}
        porUnidade={porUnidade.map((r) => ({ nome: r.nome, cliques: Number(r.cliques) }))}
        porDepartamento={porDepartamento.map((r) => ({ nome: r.nome, cliques: Number(r.cliques) }))}
        mediaPorUnidade={mediaPorUnidade}
        evolucaoSemanal={evolucaoSemanal.map((r) => ({ semana: r.semana, cliques: Number(r.cliques) }))}
      />
    </div>
  );
}
