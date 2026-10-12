import Link from 'next/link';
import { TituloPagina, Secao, Tabela } from '@/components/shopping/Comum';
import { Planta } from '@/components/shopping/Planta';
import { GraficoBarras, GraficoLinhas } from '@/components/shopping/Graficos';
import { SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { formatarData, formatarNumero, fluxoZonaPorHora, origemDoFluxo, rankingZonas, rotasAPartirDe } from '@/lib/shopping/demo';
import { ANDARES, ENTRADAS, LOJAS, areaPorId, zonaPorId, type Andar } from '@/lib/shopping/planta';
import { periodoDaBusca, um, type Busca } from '@/lib/shopping/filtros';

function fmtPermanencia(s: number) {
  return s >= 90 ? `${Math.round(s / 60)} min` : `${s} s`;
}

export default async function CorredoresPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const periodo = periodoDaBusca(sp);
  const zonaSel = zonaPorId(um(sp.zona) ?? '') ?? zonaPorId('T-C2-n')!;
  const andar = (um(sp.andar) as Andar) || zonaSel.andar;

  const ranking = rankingZonas(periodo.inicio, periodo.fim);
  const rankingAndar = ranking.filter((r) => r.zona.andar === andar);
  const valores = Object.fromEntries(ranking.map((r) => [r.zona.id, r.mediaHora]));
  const linhaSel = ranking.find((r) => r.zona.id === zonaSel.id)!;
  const posicao = ranking.findIndex((r) => r.zona.id === zonaSel.id) + 1;
  const lojasEmFrente = LOJAS.filter((l) => l.frenteZonaId === zonaSel.id);
  const porHora = fluxoZonaPorHora(zonaSel.id, periodo.inicio, periodo.fim);
  const origem = origemDoFluxo(zonaSel.id);
  const rotas = ENTRADAS.flatMap((e) => rotasAPartirDe(e.id, 4, 12).map((r) => ({ ...r, p: r.p * e.peso })))
    .filter((r) => r.caminho.includes(zonaSel.areaId))
    .sort((a, b) => b.p - a.p)
    .slice(0, 4);
  const somaRotas = rotas.reduce((s, r) => s + r.p, 0);

  const baseLink = `/shopping/corredores?periodo=${periodo.rotulo === 'personalizado' ? 30 : periodo.rotulo}&andar=${andar}&zona=`;

  return (
    <div>
      <TituloPagina titulo="Corredores e lojas" descricao="Fluxo por área de corredor. A área em frente a cada loja é a metade do corredor encostada nela (as câmeras são só de corredor, nunca dentro das lojas)." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="zona" value={zonaSel.id} />
        <SelectField label="Andar" name="andar" defaultValue={andar} className="w-36">
          {ANDARES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
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
      </form>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Secao titulo="Clique numa área para ver o detalhe" descricao="Cor = média de passagens por hora no período" className="xl:col-span-3">
          <Planta andar={andar} valores={valores} formatarValor="pessoas" selecionada={zonaSel.id} linkZona={baseLink} lojaDestacada={lojasEmFrente[0]?.id} />
        </Secao>

        <Secao titulo={zonaSel.nome} descricao={`${zonaSel.corredor} · ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`} className="xl:col-span-2">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-on-surface-variant">Fluxo total</p>
              <p className="text-xl font-semibold tabular-nums text-on-surface">{formatarNumero(linhaSel.total)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Média por hora</p>
              <p className="text-xl font-semibold tabular-nums text-on-surface">{formatarNumero(linhaSel.mediaHora)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Pico</p>
              <p className="text-xl font-semibold text-on-surface">
                {linhaSel.picoHora}h–{linhaSel.picoHora + 1}h
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Permanência média</p>
              <p className="text-xl font-semibold text-on-surface">{fmtPermanencia(linhaSel.permanenciaS)}</p>
            </div>
          </div>
          <p className="mb-2 text-xs text-on-surface-variant">
            {posicao}º de {ranking.length} áreas no ranking · lojas em frente: {lojasEmFrente.length ? lojasEmFrente.map((l) => `${l.nome} (${l.categoria})`).join(', ') : 'nenhuma (área de circulação)'}
          </p>
          <GraficoLinhas dados={porHora} x="hora" series={[{ chave: 'media', nome: 'Média por hora' }]} altura={180} />
        </Secao>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Secao titulo="Origem do fluxo" descricao="De onde vêm as pessoas que passam por esta área · estimativa estatística (modelo de transições entre câmeras vizinhas)">
          <GraficoBarras dados={origem.map((o) => ({ origem: o.origem, pct: o.pct }))} x="origem" series={[{ chave: 'pct', nome: '% do fluxo' }]} horizontal altura={240} />
        </Secao>
        <Secao titulo="Principais rotas que passam aqui" descricao="Estimativa estatística · % entre as rotas mais prováveis">
          <ol className="flex flex-col gap-3">
            {rotas.map((r, i) => (
              <li key={i} className="text-sm">
                <div className="mb-1 flex justify-between gap-3">
                  <span className="text-on-surface">{r.caminho.map((a) => areaPorId(a)?.nome ?? a).join(' → ')}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-on-surface">{Math.round((100 * r.p) / somaRotas)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container">
                  <div className="h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${(100 * r.p) / somaRotas}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <Link href="/shopping/rotas" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Ver rotas e fluxo completos →
          </Link>
        </Secao>
      </div>

      <Secao titulo={`Ranking de áreas · ${ANDARES.find((a) => a.id === andar)?.nome}`} descricao="Ordenado por fluxo total no período">
        <Tabela
          cabecalho={['#', 'Área', 'Corredor', 'Fluxo total', 'Média/hora', 'Pico', 'Permanência']}
          alinharDireita={[3, 4]}
          linhas={rankingAndar.map((r, i) => [
            i + 1,
            <Link key={r.zona.id} href={`${baseLink}${r.zona.id}`} className="text-primary hover:underline">
              {r.zona.nome}
            </Link>,
            r.zona.corredor,
            formatarNumero(r.total),
            formatarNumero(r.mediaHora),
            `${r.picoHora}h`,
            fmtPermanencia(r.permanenciaS),
          ])}
        />
      </Secao>
    </div>
  );
}
