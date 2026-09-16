import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessaoServidor';
import { obterColaborador } from '@/lib/cadastros';
import { obterCriterios } from '@/lib/configuracoes';
import { calcularBancoHoras, formatarMinutos } from '@/lib/bancoHoras';
import { listarAjustesColaborador } from '@/lib/ajustes';
import { listarAssinaturasColaborador } from '@/lib/assinaturas';
import { rotuloMarcacao, SEQUENCIA_MARCACOES } from '@/lib/ponto';
import { diasAtrasISO, hojeISO, formatarDataBR } from '@/lib/datas';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { criarAjusteAction, assinarPeriodoAction } from '../actions';

const STATUS_AJUSTE_VARIANTE: Record<string, 'warning' | 'success' | 'error'> = { pendente: 'warning', aprovado: 'success', rejeitado: 'error' };

export default async function CartaoPontoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inicio?: string; fim?: string }>;
}) {
  const sessao = await exigirSessao();
  const { id } = await params;
  const sp = await searchParams;
  const colaboradorId = Number(id);

  const colaborador = await obterColaborador(sessao.empresaId, colaboradorId);
  if (!colaborador) notFound();

  const inicio = sp.inicio || diasAtrasISO(27);
  const fim = sp.fim || hojeISO();

  const [criterios, resumo, ajustes, assinaturas] = await Promise.all([
    obterCriterios(sessao.empresaId),
    calcularBancoHoras(colaborador, inicio, fim, 0),
    listarAjustesColaborador(sessao.empresaId, colaboradorId),
    listarAssinaturasColaborador(sessao.empresaId, colaboradorId),
  ]);

  const resumoComPercentual = await calcularBancoHoras(colaborador, inicio, fim, criterios.percentual_hora_extra_padrao);
  const assinaturaAtual = assinaturas.find((a) => a.periodo_inicio <= fim && a.periodo_fim >= inicio);

  return (
    <div>
      <Link href="/ponto" className="mb-4 inline-block text-sm text-on-surface-variant hover:text-on-surface">
        ‹ Voltar
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-on-surface">{colaborador.nome}</h1>
        {assinaturaAtual && (
          <Badge variant={assinaturaAtual.assinado_em ? 'success' : 'warning'}>{assinaturaAtual.assinado_em ? 'Cartão assinado' : 'Assinatura pendente'}</Badge>
        )}
      </div>
      <p className="mb-6 text-sm text-on-surface-variant">
        {colaborador.cargo ?? 'Sem cargo cadastrado'} · Jornada padrão {colaborador.horario_entrada_padrao.slice(0, 5)}–{colaborador.horario_saida_padrao.slice(0, 5)}
      </p>

      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <Field label="De" type="date" name="inicio" defaultValue={inicio} className="w-40" />
        <Field label="Até" type="date" name="fim" defaultValue={fim} className="w-40" />
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
        {assinaturaAtual && !assinaturaAtual.assinado_em && (
          <form action={assinarPeriodoAction} className="ml-auto">
            <input type="hidden" name="assinaturaId" value={assinaturaAtual.id} />
            <input type="hidden" name="colaboradorId" value={colaboradorId} />
            <Button size="sm" type="submit">
              Confirmar assinatura do período
            </Button>
          </form>
        )}
      </form>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-on-surface">Banco de horas — {formatarDataBR(inicio)} a {formatarDataBR(fim)}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Trabalhado</p>
            <p className="text-xl font-semibold text-on-surface">{formatarMinutos(resumoComPercentual.minutosTrabalhadosTotal)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Esperado</p>
            <p className="text-xl font-semibold text-on-surface">{formatarMinutos(resumoComPercentual.minutosEsperadosTotal)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Extras</p>
            <p className="text-xl font-semibold text-primary">+{formatarMinutos(resumoComPercentual.minutosExtrasTotal)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Negativas</p>
            <p className="text-xl font-semibold text-error">-{formatarMinutos(resumoComPercentual.minutosNegativosTotal)}</p>
          </div>
        </div>
        <div className="mt-4 rounded-sm bg-surface-container-low p-3 text-xs text-on-surface-variant">
          Fórmula: extras × (1 + {resumoComPercentual.percentualHoraExtra}%) − negativas = {formatarMinutos(resumoComPercentual.minutosExtrasTotal)} ×{' '}
          {(1 + resumoComPercentual.percentualHoraExtra / 100).toFixed(2)} − {formatarMinutos(resumoComPercentual.minutosNegativosTotal)}
        </div>
        <p className="mt-3 text-sm font-semibold text-on-surface">
          Saldo do período:{' '}
          <span className={resumoComPercentual.saldoFinalMinutos >= 0 ? 'text-primary' : 'text-error'}>{formatarMinutos(resumoComPercentual.saldoFinalMinutos)}</span>
        </p>
      </Card>

      <Card className="mb-6 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3 font-medium">Data</th>
                {SEQUENCIA_MARCACOES.map((t) => (
                  <th key={t} className="px-3 py-3 font-medium">
                    {rotuloMarcacao(t)}
                  </th>
                ))}
                <th className="px-3 py-3 font-medium">Trabalhado</th>
                <th className="px-3 py-3 font-medium">Divergência</th>
              </tr>
            </thead>
            <tbody>
              {resumo.dias
                .slice()
                .reverse()
                .map((dia) => (
                  <tr key={dia.data} className="border-b border-outline-variant/50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-on-surface">{formatarDataBR(dia.data)}</td>
                    {SEQUENCIA_MARCACOES.map((tipo) => {
                      const m = dia.marcacoes.find((x) => x.tipo === tipo);
                      return (
                        <td key={tipo} className="px-3 py-2.5 text-on-surface-variant">
                          {m ? (
                            <span className={m.origem === 'ajuste' ? 'font-medium text-primary' : ''}>
                              {m.horario.toISOString().slice(11, 16)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-on-surface-variant">{dia.minutosTrabalhados > 0 ? formatarMinutos(dia.minutosTrabalhados) : '—'}</td>
                    <td className="px-3 py-2.5">
                      {dia.minutosEsperados === 0 && dia.minutosTrabalhados === 0 ? (
                        <span className="text-on-surface-variant">—</span>
                      ) : (
                        <Badge variant={dia.divergenciaMinutos < 0 ? 'error' : dia.divergenciaMinutos > 0 ? 'primary' : 'neutral'}>
                          {dia.divergenciaMinutos >= 0 ? '+' : ''}
                          {formatarMinutos(dia.divergenciaMinutos)}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-on-surface">Solicitar ajuste</h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          Registro de ponto é imutável — um ajuste nunca apaga a marcação original, só complementa com uma correção justificada, que fica pendente até um admin
          aprovar.
        </p>
        <form action={criarAjusteAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="colaboradorId" value={colaboradorId} />
          <SelectField label="Tipo de ajuste" name="tipoAjuste" defaultValue="inclusao">
            <option value="inclusao">Inclusão (faltou bater)</option>
            <option value="correcao">Correção de horário</option>
            <option value="exclusao_justificada">Exclusão justificada</option>
          </SelectField>
          <SelectField label="Marcação" name="tipoMarcacao" defaultValue="ENTRADA_1">
            {SEQUENCIA_MARCACOES.map((t) => (
              <option key={t} value={t}>
                {rotuloMarcacao(t)}
              </option>
            ))}
          </SelectField>
          <Field label="Data" type="date" name="data" defaultValue={hojeISO()} required />
          <Field label="Horário correto" type="time" name="hora" required />
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Justificativa</span>
            <textarea
              name="justificativa"
              required
              rows={2}
              className="w-full rounded-sm border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Explique o motivo do ajuste"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">Enviar solicitação</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-on-surface">Histórico de ajustes</h2>
        {ajustes.length === 0 ? (
          <p className="py-2 text-sm text-on-surface-variant">Nenhum ajuste solicitado ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/60">
            {ajustes.map((a) => (
              <li key={a.id} className="py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_AJUSTE_VARIANTE[a.status]}>{a.status}</Badge>
                  <span className="text-on-surface-variant">{a.tipo_ajuste}</span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">&ldquo;{a.justificativa}&rdquo;</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
