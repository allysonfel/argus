import { AlternarSimulacao } from '@/components/shopping/AlternarSimulacao';
import { exigirAba } from '@/lib/sessaoServidor';
import { TituloPagina, Secao, Tabela, Variacao } from '@/components/shopping/Comum';
import { GraficoBarras, GraficoLinhas } from '@/components/shopping/Graficos';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { agoraDemo, corredores, DIAS_SEMANA, DIAS_SEMANA_CURTO, diaSemana, formatarData, formatarNumero, INICIO_HISTORICO, nomeEscopo, serieDiaria, somarDias, type Escopo } from '@/lib/shopping/demo';
import { datasComerciais, janela } from '@/lib/shopping/datasComerciais';
import { ANDARES, ZONAS } from '@/lib/shopping/planta';
import { um, type Busca } from '@/lib/shopping/filtros';

function escopoDe(v: string | undefined): Escopo {
  if (!v || v === 'shopping') return { tipo: 'shopping' };
  const [tipo, valor] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)];
  if (tipo === 'andar' && (valor === 'T' || valor === 'P1')) return { tipo: 'andar', andar: valor };
  if (tipo === 'corredor' && corredores().includes(valor)) return { tipo: 'corredor', corredor: valor };
  if (tipo === 'zona' && ZONAS.some((z) => z.id === valor)) return { tipo: 'zona', zonaId: valor };
  return { tipo: 'shopping' };
}

function dias(ini: string, fim: string) {
  return Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 86400000) + 1;
}

/** Ocorrência mais recente (já iniciada) de uma data comercial e a do ano anterior. */
function janelasDataComercial(id: string, hoje: string): { a: [string, string]; b: [string, string]; nome: string } | null {
  const ano = Number(hoje.slice(0, 4));
  for (const anoA of [ano, ano - 1]) {
    const dc = datasComerciais(anoA).find((d) => d.id === id);
    const dcAnt = datasComerciais(anoA - 1).find((d) => d.id === id);
    if (!dc || !dcAnt) return null;
    const a = janela(dc);
    if (a[0] <= hoje) return { a: [a[0], a[1] > hoje ? hoje : a[1]], b: janela(dcAnt), nome: `${dc.nome} ${anoA} x ${anoA - 1}` };
  }
  return null;
}

export default async function ComparativoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirAba('comparativo');
  const sp = await searchParams;
  const hoje = agoraDemo().data;
  const escopoParam = um(sp.escopo) ?? 'shopping';
  const escopo = escopoDe(escopoParam);
  const dcId = um(sp.data) ?? '';
  // "Data comercial" sem uma data escolhida = mesmo período do ano anterior.
  const modoParam = um(sp.modo) ?? 'ano';
  const modo = modoParam === 'data' && !dcId ? 'ano' : modoParam;

  let a: [string, string] = [um(sp.de) ?? somarDias(hoje, -27), um(sp.ate) ?? hoje];
  if (a[1] > hoje) a[1] = hoje;
  if (a[0] > a[1]) a = [a[1], a[1]];
  let b: [string, string];
  let titulo: string;
  const n = dias(a[0], a[1]);

  if (modo === 'data') {
    const j = janelasDataComercial(dcId, hoje);
    a = j?.a ?? a;
    b = j?.b ?? [somarDias(a[0], -364), somarDias(a[1], -364)];
    titulo = j?.nome ?? 'Data comercial';
  } else if (modo === 'anterior') {
    // Recuo em semanas inteiras: cada dia é comparado com o mesmo dia da semana
    const recuo = Math.ceil(n / 7) * 7;
    b = [somarDias(a[0], -recuo), somarDias(a[1], -recuo)];
    titulo = 'Período atual x período anterior';
  } else if (modo === 'livre') {
    b = [um(sp.de2) ?? somarDias(a[0], -364), um(sp.ate2) ?? somarDias(a[1], -364)];
    titulo = 'Período A x período B';
  } else {
    // 364 dias = 52 semanas: mesmo dia da semana do ano anterior
    b = [somarDias(a[0], -364), somarDias(a[1], -364)];
    titulo = 'Ano a ano (alinhado pelo dia da semana)';
  }

  const insuficiente = b[0] < INICIO_HISTORICO;
  const serieA = serieDiaria(escopo, a[0], a[1]);
  const serieB = insuficiente ? [] : serieDiaria(escopo, b[0] < INICIO_HISTORICO ? INICIO_HISTORICO : b[0], b[1]);
  const totalA = serieA.reduce((s, d) => s + d.valor, 0);
  const totalB = serieB.reduce((s, d) => s + d.valor, 0);
  const mediaA = totalA / Math.max(1, serieA.length);
  const mediaB = totalB / Math.max(1, serieB.length);
  const melhorA = serieA.reduce((m, d) => (d.valor > m.valor ? d : m), serieA[0]);

  const linhas = Array.from({ length: Math.max(serieA.length, serieB.length) }, (_, i) => ({ dia: i + 1, a: serieA[i]?.valor ?? null, b: serieB[i]?.valor ?? null }));
  const porDiaSemana = DIAS_SEMANA_CURTO.map((d, i) => {
    const da = serieA.filter((s) => diaSemana(s.data) === i);
    const db = serieB.filter((s) => diaSemana(s.data) === i);
    return { dia: d, a: da.length ? Math.round(da.reduce((s, x) => s + x.valor, 0) / da.length) : 0, b: db.length ? Math.round(db.reduce((s, x) => s + x.valor, 0) / db.length) : 0 };
  });

  const rotA = `${formatarData(a[0])} a ${formatarData(a[1])}`;
  const rotB = `${formatarData(b[0])} a ${formatarData(b[1])}`;
  const unidade = escopo.tipo === 'shopping' ? 'entradas' : 'passagens';
  const ano = Number(hoje.slice(0, 4));

  const simulado = (
    <div>
      <TituloPagina titulo="Comparativo de períodos" descricao="Compare qualquer período com outro, com os dias alinhados pelo dia da semana (sábado com sábado). Vale para o shopping inteiro, um andar, um corredor ou uma área." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField label="O que comparar" name="escopo" defaultValue={escopoParam} className="w-64">
          <option value="shopping">Shopping inteiro (entradas)</option>
          <optgroup label="Andar">
            {ANDARES.map((x) => (
              <option key={x.id} value={`andar:${x.id}`}>
                {x.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Corredor">
            {corredores().map((c) => (
              <option key={c} value={`corredor:${c}`}>
                {c}
              </option>
            ))}
          </optgroup>
          <optgroup label="Área">
            {ZONAS.map((z) => (
              <option key={z.id} value={`zona:${z.id}`}>
                {z.nome}
              </option>
            ))}
          </optgroup>
        </SelectField>
        <SelectField label="Tipo de comparação" name="modo" defaultValue={modoParam} className="w-56">
          <option value="ano">Mesmo período do ano anterior</option>
          <option value="anterior">Período imediatamente anterior</option>
          <option value="data">Data comercial (ano a ano)</option>
          <option value="livre">Dois períodos quaisquer</option>
        </SelectField>
        <SelectField label="Data comercial" name="data" defaultValue={dcId} className="w-48">
          <option value="">Sem data comercial</option>
          {datasComerciais(ano).map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </SelectField>
        <Field label="Período A: de" name="de" type="date" defaultValue={a[0]} max={hoje} className="w-40" />
        <Field label="até" name="ate" type="date" defaultValue={a[1]} max={hoje} className="w-40" />
        <Field label="Período B: de" name="de2" type="date" defaultValue={b[0]} className="w-40" />
        <Field label="até" name="ate2" type="date" defaultValue={b[1]} className="w-40" />
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Comparar
        </Button>
      </form>
      <p className="-mt-3 mb-6 text-xs text-on-surface-variant">A data comercial é opcional e vale só no tipo “Data comercial” (sem ela, compara com o mesmo período do ano anterior); o período B digitado vale só em “Dois períodos quaisquer”. Nos outros tipos, B é calculado a partir de A.</p>

      {insuficiente ? (
        <Alert variant="warning" className="mb-6">
          Histórico insuficiente: o período B ({rotB}) começa antes do início dos dados ({formatarData(INICIO_HISTORICO)}). Escolha um período mais recente.
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <StatCard label={`Total de ${unidade} · A`} value={formatarNumero(totalA)} hint={rotA} tone="primary" />
          {!insuficiente && (
            <div className="px-1 pt-2">
              <Variacao atual={totalA} anterior={totalB} sufixo="vs. período B" />
            </div>
          )}
        </div>
        <StatCard label={`Total de ${unidade} · B`} value={insuficiente ? '—' : formatarNumero(totalB)} hint={rotB} />
        <div>
          <StatCard label="Média por dia · A" value={formatarNumero(mediaA)} hint={`B: ${insuficiente ? '—' : formatarNumero(mediaB)}`} />
          {!insuficiente && (
            <div className="px-1 pt-2">
              <Variacao atual={mediaA} anterior={mediaB} sufixo="na média diária" />
            </div>
          )}
        </div>
        <StatCard label="Melhor dia de A" value={melhorA ? formatarData(melhorA.data).slice(0, 5) : '—'} hint={melhorA ? `${DIAS_SEMANA[diaSemana(melhorA.data)]} · ${formatarNumero(melhorA.valor)} ${unidade}` : undefined} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo={titulo} descricao={`${nomeEscopo(escopo)} · ${unidade} por dia · A: ${rotA} · B: ${rotB}`} className="xl:col-span-2">
          <GraficoLinhas
            dados={linhas}
            x="dia"
            formatoX="dia"
            series={[
              { chave: 'a', nome: `A (${rotA})`, cor: 1 },
              { chave: 'b', nome: `B (${rotB})`, cor: 2, tracejada: true },
            ]}
          />
        </Secao>
        <Secao titulo="Média por dia da semana" descricao={`${unidade} por dia`}>
          <GraficoBarras
            dados={porDiaSemana}
            x="dia"
            series={[
              { chave: 'a', nome: 'A', cor: 1 },
              { chave: 'b', nome: 'B', cor: 2 },
            ]}
            altura={280}
          />
        </Secao>
      </div>

      <Secao titulo="Calendário de datas comerciais" descricao="Datas móveis calculadas para cada ano (Carnaval e Páscoa pela data da Páscoa, Dia das Mães e dos Pais pelo 2º domingo, Black Friday pela 4ª quinta de novembro). A janela é o período de efeito no movimento.">
        <Tabela
          cabecalho={['Data comercial', `${ano - 1}`, `${ano}`, `${ano + 1}`, 'Janela considerada']}
          linhas={datasComerciais(ano).map((d) => {
            const em = (y: number) => formatarData(datasComerciais(y).find((x) => x.id === d.id)!.data);
            return [d.nome, em(ano - 1), em(ano), em(ano + 1), `${d.diasAntes} dia(s) antes${d.diasDepois ? ` e ${d.diasDepois} depois` : ''}`];
          })}
        />
      </Secao>
    </div>
  );
  return <AlternarSimulacao real={<div><TituloPagina titulo="Comparativo de períodos" /><Secao titulo="Disponível na simulação" descricao="Comparar períodos precisa de histórico de vários dias."><p className="text-sm text-on-surface-variant">Os vídeos das 15 câmeras de demonstração são uma gravação só, então ainda não existe histórico para comparar uma semana com outra. Com as câmeras do shopping ligadas, esta tela compara os períodos com os dados reais. Para ver como fica, ligue a Simulação do shopping no canto superior direito.</p></Secao></div>} simulado={simulado} />;
}
