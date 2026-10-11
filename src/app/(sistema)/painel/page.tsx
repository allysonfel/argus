import Link from 'next/link';
import { exigirSessao } from '@/lib/sessaoServidor';
import { obterCriterios } from '@/lib/configuracoes';
import { contarColaboradoresAtivos } from '@/lib/cadastros';
import { contarPresentesHoje } from '@/lib/ponto';
import { listarAtrasosDoDia, listarSemRegistroHoje } from '@/lib/alertas';
import { contarAjustesPendentesAntigos, contarAjustesPendentes } from '@/lib/ajustes';
import { contarAssinaturasPendentesAntigas } from '@/lib/assinaturas';
import { contarSolicitacoesPendentes, listarProximosEventos, contarAdmissoesEmAndamento } from '@/lib/eventosPessoas';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconePessoas, IconePonto, IconePredio, IconeAlerta, IconeSeta, IconeCalendario } from '@/components/ui/icones';
import { formatarDataBR } from '@/lib/datas';

const RUBRICAS_EVENTO: Record<string, string> = {
  ferias: 'Férias',
  afastamento: 'Afastamento',
  home_office: 'Home office',
};

export default async function VisaoGeralPage() {
  const sessao = await exigirSessao();
  const empresaId = sessao.empresaId;
  const criterios = await obterCriterios(empresaId);

  const [ativos, presentesHoje, atrasos, semRegistro, ajustesAntigos, ajustesPendentesTotal, assinaturasAntigas, solicitacoesPendentes, proximosEventos, admissoes] =
    await Promise.all([
      contarColaboradoresAtivos(empresaId),
      contarPresentesHoje(empresaId),
      listarAtrasosDoDia(empresaId, criterios.limiar_atraso_minutos),
      listarSemRegistroHoje(empresaId, criterios.limiar_atraso_minutos),
      contarAjustesPendentesAntigos(empresaId, criterios.limiar_ajuste_pendente_dias),
      contarAjustesPendentes(empresaId),
      contarAssinaturasPendentesAntigas(empresaId, criterios.limiar_cartao_sem_assinatura_dias),
      contarSolicitacoesPendentes(empresaId),
      listarProximosEventos(empresaId, 14),
      contarAdmissoesEmAndamento(empresaId, 30),
    ]);

  const itensAtencao = [
    semRegistro.length > 0 && {
      href: '/ponto',
      contagem: semRegistro.length,
      texto: `colaborador${semRegistro.length > 1 ? 'es' : ''} sem registro de ponto hoje, já passado o horário esperado`,
    },
    assinaturasAntigas > 0 && {
      href: '/ponto/pendencias',
      contagem: assinaturasAntigas,
      texto: `cartão(ões) de ponto sem assinatura há mais de ${criterios.limiar_cartao_sem_assinatura_dias} dias`,
    },
    ajustesAntigos > 0 && {
      href: '/ponto/pendencias',
      contagem: ajustesAntigos,
      texto: `ajuste(s) de ponto aguardando análise há mais de ${criterios.limiar_ajuste_pendente_dias} dias`,
    },
    solicitacoesPendentes > 0 && {
      href: '/ponto/pendencias',
      contagem: solicitacoesPendentes,
      texto: `solicitação(ões) pendente(s) (férias, afastamento, home office)`,
    },
  ].filter(Boolean) as { href: string; contagem: number; texto: string }[];

  const totalPendencias = itensAtencao.reduce((acc, i) => acc + i.contagem, 0);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-on-surface">
        {saudacao}, {sessao.nome.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        {totalPendencias > 0 ? (
          <>
            Você tem <span className="font-semibold text-on-surface">{totalPendencias} {totalPendencias === 1 ? 'item' : 'itens'}</span> que
            precisa{totalPendencias === 1 ? '' : 'm'} de atenção.
          </>
        ) : (
          'Tudo em dia — nenhuma pendência crítica no momento.'
        )}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Colaboradores ativos" value={ativos} icon={<IconePessoas width={22} height={22} />} />
        <StatCard label="Presentes hoje" value={presentesHoje} icon={<IconePonto width={22} height={22} />} tone="primary" />
        <StatCard label="Admissões (30 dias)" value={admissoes} icon={<IconePredio width={22} height={22} />} />
        <StatCard label="Pendências prioritárias" value={totalPendencias} icon={<IconeAlerta width={22} height={22} />} tone={totalPendencias > 0 ? 'warning' : 'neutral'} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-1 text-base font-semibold text-on-surface">O que precisa da sua atenção</h2>
          <p className="mb-4 text-xs text-on-surface-variant">Cada item leva direto pra resolver.</p>
          {itensAtencao.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">Nenhuma pendência agora. 🎉</p>
          ) : (
            <ul className="flex flex-col divide-y divide-outline-variant/60">
              {itensAtencao.map((item, i) => (
                <li key={i}>
                  <Link href={item.href} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                    <span className="flex items-center gap-3 text-sm">
                      <Badge variant="warning">{item.contagem}</Badge>
                      {item.texto}
                    </span>
                    <IconeSeta className="shrink-0 text-on-surface-variant" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-on-surface">
            <IconeCalendario width={18} height={18} /> Pessoas em movimento
          </h2>
          <p className="mb-4 text-xs text-on-surface-variant">Próximos 14 dias.</p>
          {proximosEventos.length === 0 ? (
            <p className="py-4 text-center text-sm text-on-surface-variant">Nada programado.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {proximosEventos.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="font-medium text-on-surface">{e.colaborador_nome}</p>
                  <p className="text-xs text-on-surface-variant">
                    <Badge variant="secondary" className="mr-1.5">
                      {RUBRICAS_EVENTO[e.tipo]}
                    </Badge>
                    {formatarDataBR(e.data_inicio)}
                    {e.data_fim ? ` – ${formatarDataBR(e.data_fim)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-1 text-base font-semibold text-on-surface">Atrasos do dia</h2>
        <p className="mb-4 text-xs text-on-surface-variant">Entrada registrada depois do horário + tolerância configurada.</p>
        {atrasos.length === 0 ? (
          <p className="py-4 text-center text-sm text-on-surface-variant">Ninguém atrasado hoje.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
                  <th className="pb-2 pr-4 font-medium">Colaborador</th>
                  <th className="pb-2 pr-4 font-medium">Unidade</th>
                  <th className="pb-2 pr-4 font-medium">Esperado</th>
                  <th className="pb-2 pr-4 font-medium">Registrado</th>
                  <th className="pb-2 font-medium">Atraso</th>
                </tr>
              </thead>
              <tbody>
                {atrasos.map((a) => (
                  <tr key={a.colaborador_id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-on-surface">{a.colaborador_nome}</td>
                    <td className="py-2.5 pr-4 text-on-surface-variant">{a.unidade_nome ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-on-surface-variant">{a.horario_esperado.slice(0, 5)}</td>
                    <td className="py-2.5 pr-4 text-on-surface-variant">{a.horario_real}</td>
                    <td className="py-2.5">
                      <Badge variant="error">{a.minutos_atraso} min</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
