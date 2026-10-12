import { TituloPagina, Secao, Tabela } from '@/components/shopping/Comum';
import { CentralAlertas } from '@/components/shopping/CentralAlertas';
import { Badge } from '@/components/ui/Badge';
import { AREAS_RESTRITAS } from '@/lib/shopping/planta';
import { REGRAS_ANTI_FALSO, alertasDemo, manutencoesDemo, nomeAreaRestrita } from '@/lib/shopping/seguranca';

const dataHora = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11)}`;

export default function AreasRestritasPage() {
  const alertas = alertasDemo();
  const nomes = Object.fromEntries(AREAS_RESTRITAS.map((a) => [a.id, a.nome]));
  const manutencoes = manutencoesDemo();
  const pessoas = alertas.filter((a) => a.tipo === 'Pessoa em área restrita');

  return (
    <div>
      <TituloPagina
        titulo="Áreas restritas 24h"
        descricao="Alerta imediato quando alguém entra numa área restrita fora do horário permitido, ou quando a câmera dessa área fica offline, escura, tapada ou desviada. Acesso: perfis Segurança e Administração."
      />

      <Secao titulo="Central de alertas" descricao="Fluxo: Novo → Em atendimento → Resolvido ou Falso alarme, sempre com responsável e observação" className="mb-6">
        <CentralAlertas iniciais={alertas} nomes={nomes} />
      </Secao>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Secao titulo="Áreas cadastradas" descricao="Agenda de monitoramento de cada área">
          <Tabela
            cabecalho={['Área', 'Câmera', 'Monitorada', 'Situação']}
            linhas={AREAS_RESTRITAS.map((a) => [
              a.nome,
              a.cameraId,
              a.agenda,
              a.id === 'ar-telhado' ? <Badge variant="error">Câmera escura</Badge> : <Badge variant="success">Armada</Badge>,
            ])}
          />
        </Secao>
        <Secao titulo="Janelas de manutenção agendadas" descricao="Nesses horários a área não gera alerta de pessoa (alerta de câmera continua)">
          <Tabela cabecalho={['Área', 'Início', 'Fim', 'Motivo', 'Agendado por']} linhas={manutencoes.map((m) => [nomeAreaRestrita(m.areaId), dataHora(m.inicio), dataHora(m.fim), m.motivo, m.agendadoPor])} />
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo="Anti-falso-alarme" descricao="Valores padrão, ajustáveis por área">
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ['Confiança mínima', `${REGRAS_ANTI_FALSO.confiancaMinimaPct}% (corredores usam 40%)`],
              ['Permanência mínima', `${REGRAS_ANTI_FALSO.permanenciaMinimaS} s na área`],
              ['Quadros consecutivos', `${REGRAS_ANTI_FALSO.quadrosConsecutivos}`],
              ['Infravermelho', REGRAS_ANTI_FALSO.infravermelho],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-on-surface-variant">{k}</dt>
                <dd className="text-on-surface">{v}</dd>
              </div>
            ))}
          </dl>
        </Secao>
        <Secao titulo="Falsos alarmes por área" descricao="Últimos 7 dias · ajuda a calibrar as regras">
          <Tabela
            cabecalho={['Área', 'Alertas', 'Falsos', '%']}
            alinharDireita={[1, 2, 3]}
            linhas={AREAS_RESTRITAS.map((a) => {
              const da = pessoas.filter((p) => p.areaId === a.id);
              const falsos = da.filter((p) => p.status === 'falso').length;
              return [a.nome, da.length, falsos, da.length ? `${Math.round((100 * falsos) / da.length)}%` : '—'];
            })}
          />
        </Secao>
        <Secao titulo="Avisos externos" descricao="Interface genérica de notificação, pronta para plugar">
          <ul className="flex flex-col gap-2 text-sm">
            {[
              ['Painel (som + destaque)', true],
              ['WhatsApp', false],
              ['Telegram', false],
              ['E-mail', false],
            ].map(([canal, ativo]) => (
              <li key={String(canal)} className="flex items-center justify-between">
                <span className="text-on-surface">{canal}</span>
                {ativo ? <Badge variant="success">Ativo</Badge> : <Badge>Não configurado</Badge>}
              </li>
            ))}
          </ul>
        </Secao>
      </div>
    </div>
  );
}
