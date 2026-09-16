import Link from 'next/link';
import { exigirSessao } from '@/lib/sessaoServidor';
import { listarAjustesPendentes } from '@/lib/ajustes';
import { listarAssinaturasPendentes } from '@/lib/assinaturas';
import { listarSolicitacoesPendentes } from '@/lib/eventosPessoas';
import { rotuloMarcacao } from '@/lib/ponto';
import { formatarDataBR, formatarDataHoraBR } from '@/lib/datas';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { decidirAjusteAction, assinarPeriodoAction, decidirSolicitacaoAction } from '../actions';

const RUBRICA_AJUSTE: Record<string, string> = { inclusao: 'Inclusão', correcao: 'Correção', exclusao_justificada: 'Exclusão justificada' };
const RUBRICA_EVENTO: Record<string, string> = { ferias: 'Férias', afastamento: 'Afastamento', home_office: 'Home office' };

export default async function PendenciasPontoPage() {
  const sessao = await exigirSessao();
  const [ajustes, assinaturas, solicitacoes] = await Promise.all([
    listarAjustesPendentes(sessao.empresaId),
    listarAssinaturasPendentes(sessao.empresaId),
    listarSolicitacoesPendentes(sessao.empresaId),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-on-surface">Pendências de ponto</h1>
      <p className="mb-6 text-sm text-on-surface-variant">Ajustes aguardando análise, cartões sem assinatura e solicitações de colaboradores.</p>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-on-surface">Ajustes aguardando análise ({ajustes.length})</h2>
        {ajustes.length === 0 ? (
          <p className="py-4 text-center text-sm text-on-surface-variant">Nenhum ajuste pendente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/60">
            {ajustes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium text-on-surface">
                    {a.colaborador_nome} <Badge variant="secondary">{RUBRICA_AJUSTE[a.tipo_ajuste]}</Badge>
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {a.tipo_marcacao && `${rotuloMarcacao(a.tipo_marcacao)} · `}
                    Novo horário: {formatarDataHoraBR(a.horario_ajustado)}
                  </p>
                  <p className="mt-1 text-xs italic text-on-surface-variant">&ldquo;{a.justificativa}&rdquo;</p>
                </div>
                <div className="flex gap-2">
                  <form action={decidirAjusteAction}>
                    <input type="hidden" name="ajusteId" value={a.id} />
                    <input type="hidden" name="colaboradorId" value={a.colaborador_id} />
                    <input type="hidden" name="decisao" value="aprovado" />
                    <Button size="sm" type="submit">
                      Aprovar
                    </Button>
                  </form>
                  <form action={decidirAjusteAction}>
                    <input type="hidden" name="ajusteId" value={a.id} />
                    <input type="hidden" name="colaboradorId" value={a.colaborador_id} />
                    <input type="hidden" name="decisao" value="rejeitado" />
                    <Button size="sm" variant="outline" type="submit">
                      Rejeitar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-on-surface">Cartões-ponto sem assinatura ({assinaturas.length})</h2>
        {assinaturas.length === 0 ? (
          <p className="py-4 text-center text-sm text-on-surface-variant">Tudo assinado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/60">
            {assinaturas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/ponto/${a.colaborador_id}`} className="font-medium text-on-surface hover:text-primary">
                    {a.colaborador_nome}
                  </Link>
                  <p className="text-xs text-on-surface-variant">
                    Período {formatarDataBR(a.periodo_inicio)} – {formatarDataBR(a.periodo_fim)}
                  </p>
                </div>
                <form action={assinarPeriodoAction}>
                  <input type="hidden" name="assinaturaId" value={a.id} />
                  <input type="hidden" name="colaboradorId" value={a.colaborador_id} />
                  <Button size="sm" variant="outline" type="submit">
                    Confirmar assinatura
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-on-surface">Solicitações pendentes ({solicitacoes.length})</h2>
        {solicitacoes.length === 0 ? (
          <p className="py-4 text-center text-sm text-on-surface-variant">Nenhuma solicitação pendente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/60">
            {solicitacoes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-on-surface">
                    {s.colaborador_nome} <Badge variant="secondary">{RUBRICA_EVENTO[s.tipo]}</Badge>
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {formatarDataBR(s.data_inicio)}
                    {s.data_fim ? ` – ${formatarDataBR(s.data_fim)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={decidirSolicitacaoAction}>
                    <input type="hidden" name="eventoId" value={s.id} />
                    <input type="hidden" name="decisao" value="aprovado" />
                    <Button size="sm" type="submit">
                      Aprovar
                    </Button>
                  </form>
                  <form action={decidirSolicitacaoAction}>
                    <input type="hidden" name="eventoId" value={s.id} />
                    <input type="hidden" name="decisao" value="rejeitado" />
                    <Button size="sm" variant="outline" type="submit">
                      Rejeitar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
