import Link from 'next/link';
import { TituloPagina, Secao, Tabela, Variacao } from '@/components/shopping/Comum';
import { GraficoBarras, GraficoLinhas } from '@/components/shopping/Graficos';
import { Planta } from '@/components/shopping/Planta';
import { BotaoImprimir } from '@/components/shopping/BotaoImprimir';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { formatarData, formatarNumero, metricasLoja, origemDoFluxo, passantesPorDia, somarDias } from '@/lib/shopping/demo';
import { LOJAS, lojaPorId, zonaPorId } from '@/lib/shopping/planta';
import { periodoDaBusca, um, type Busca } from '@/lib/shopping/filtros';

export default async function LojistaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const periodo = periodoDaBusca(sp);
  const loja = lojaPorId(um(sp.loja) ?? '') ?? LOJAS.find((l) => l.plano === 'Completo' && l.portaVisivel)!;
  const zona = zonaPorId(loja.frenteZonaId)!;

  // Período anterior de mesmo tamanho, recuado em semanas inteiras
  const recuo = Math.ceil(periodo.dias / 7) * 7;
  const antIni = somarDias(periodo.inicio, -recuo);
  const antFim = somarDias(periodo.fim, -recuo);

  const m = metricasLoja(loja.id, periodo.inicio, periodo.fim);
  const ant = metricasLoja(loja.id, antIni, antFim);
  const serie = passantesPorDia(loja.id, periodo.inicio, periodo.fim);
  const serieAnt = passantesPorDia(loja.id, antIni, antFim);
  const linhas = serie.map((s, i) => ({ data: s.data, atual: s.valor, anterior: serieAnt[i]?.valor ?? null }));
  const completo = loja.plano === 'Completo';

  return (
    <div>
      <TituloPagina
        titulo="Portal do lojista"
        descricao="O que o lojista vê sobre a própria loja, medido pela câmera do corredor (nunca dentro da loja). Ele não vê dados de outras lojas: as comparações usam a média do corredor, anonimizada."
      >
        <BotaoImprimir rotulo="Relatório mensal (PDF)" />
      </TituloPagina>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <SelectField label="Visualizar como a loja" name="loja" defaultValue={loja.id} className="w-72">
          {LOJAS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome} · {l.categoria} {l.plano ? `(${l.plano})` : '(sem plano)'}
            </option>
          ))}
        </SelectField>
        <SelectField label="Período" name="periodo" defaultValue={periodo.rotulo === 'personalizado' ? '30' : periodo.rotulo} className="w-40">
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </SelectField>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Aplicar
        </Button>
        <span className="pb-2.5 text-xs text-on-surface-variant">Visão da Administração. O lojista logado vê só a própria loja.</span>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-on-surface">
          {loja.nome} · {loja.categoria}
        </h2>
        {loja.plano ? <Badge variant="primary">Plano {loja.plano}</Badge> : <Badge variant="warning">Sem assinatura</Badge>}
        <span className="text-sm text-on-surface-variant">
          {formatarData(periodo.inicio)} a {formatarData(periodo.fim)} · {zona.nome}
        </span>
      </div>

      {!loja.plano ? (
        <Alert variant="warning">Esta loja ainda não tem assinatura do Argus. Ao contratar, o lojista passa a ver passantes em frente, paradas na vitrine, origem do fluxo e o relatório mensal.</Alert>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <StatCard label="Passantes em frente" value={formatarNumero(m.passantes)} hint="Pessoas que passaram na frente da loja" tone="primary" />
              <div className="px-1 pt-2">
                <Variacao atual={m.passantes} anterior={ant.passantes} />
              </div>
            </div>
            <div>
              <StatCard label="Paradas na vitrine" value={formatarNumero(m.paradas)} hint={`${m.taxaParadaPct.toFixed(1).replace('.', ',')}% dos passantes pararam mais de 3 s`} />
              <div className="px-1 pt-2">
                <Variacao atual={m.paradas} anterior={ant.paradas} />
              </div>
            </div>
            <StatCard label="Tempo médio de parada" value={`${m.tempoMedioParadaS} s`} hint="Na frente da vitrine" />
            {/* Entradas e conversão só existem se a porta aparece na câmera do corredor; senão, nem aparecem (sem zero) */}
            {m.entradas !== null && m.conversaoPct !== null && (
              <div>
                <StatCard label="Entradas na loja" value={formatarNumero(m.entradas)} hint={`Conversão: ${m.conversaoPct.toFixed(1).replace('.', ',')}% dos passantes`} />
                <div className="px-1 pt-2">
                  <Variacao atual={m.entradas} anterior={ant.entradas ?? 0} />
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Secao titulo="Passantes por dia" descricao={`Período atual x anterior (${formatarData(antIni)} a ${formatarData(antFim)}), alinhados pelo dia da semana`} className="xl:col-span-2">
              <GraficoLinhas
                dados={linhas}
                x="data"
                formatoX="data"
                series={[
                  { chave: 'atual', nome: 'Período atual', cor: 1 },
                  { chave: 'anterior', nome: 'Período anterior', cor: 2, tracejada: true },
                ]}
              />
            </Secao>
            <Secao titulo="Sua loja x média do corredor" descricao="Passantes no período · a média não identifica nenhuma loja">
              <GraficoBarras
                dados={[
                  { nome: 'Sua loja', valor: m.passantes },
                  { nome: 'Média do corredor', valor: m.mediaCorredorPassantes },
                ]}
                x="nome"
                series={[{ chave: 'valor', nome: 'Passantes' }]}
                altura={220}
              />
              <p className="mt-2 text-sm text-on-surface">
                {m.passantes >= m.mediaCorredorPassantes ? 'Acima' : 'Abaixo'} da média em {Math.abs(Math.round(((m.passantes - m.mediaCorredorPassantes) / Math.max(1, m.mediaCorredorPassantes)) * 100))}%.
              </p>
            </Secao>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {completo ? (
              <Secao titulo="De onde vêm as pessoas que passam pela sua loja" descricao="Estimativa estatística">
                <GraficoBarras dados={origemDoFluxo(zona.id)} x="origem" series={[{ chave: 'pct', nome: '% dos passantes' }]} horizontal altura={240} />
              </Secao>
            ) : (
              <Secao titulo="De onde vêm as pessoas que passam pela sua loja">
                <p className="text-sm text-on-surface-variant">Disponível no plano Completo.</p>
              </Secao>
            )}
            <Secao titulo="Onde fica a área medida" descricao="Faixa do corredor em frente à loja">
              <Planta andar={loja.andar} lojaDestacada={loja.id} destaque={[zona.id]} />
            </Secao>
          </div>

          {m.entradas === null && <p className="mb-6 text-xs text-on-surface-variant">A porta desta loja não aparece na câmera do corredor, por isso entradas e conversão não são medidas.</p>}
        </>
      )}

      <Secao titulo="Lojas e planos" descricao="Visão da Administração: controle de assinatura por loja" className="print:hidden">
        <Tabela
          cabecalho={['Loja', 'Categoria', 'Andar', 'Porta visível', 'Plano', '']}
          linhas={LOJAS.map((l) => [
            l.nome,
            l.categoria,
            l.andar === 'T' ? 'Térreo' : 'Piso 1',
            l.portaVisivel ? 'Sim' : 'Não',
            l.plano ? <Badge key={l.id} variant={l.plano === 'Completo' ? 'primary' : 'neutral'}>{l.plano}</Badge> : <Badge key={l.id} variant="warning">Sem plano</Badge>,
            <Link key={`v${l.id}`} href={`/shopping/lojista?loja=${l.id}`} className="text-primary hover:underline">
              Ver portal
            </Link>,
          ])}
        />
      </Secao>
    </div>
  );
}
