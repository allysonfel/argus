import { exigirAba } from '@/lib/sessaoServidor';
import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { AlternarSimulacao } from '@/components/shopping/AlternarSimulacao';
import { TituloPagina, Secao, Variacao, Tabela } from '@/components/shopping/Comum';
import { GraficoLinhas, GraficoBarras } from '@/components/shopping/Graficos';
import { CalorVisaoGeral } from '@/components/shopping/simulacao/CalorVisaoGeral';
import { FiltroPeriodo } from '@/components/shopping/visao/FiltroPeriodo';
import { VisaoGeralReal } from '@/components/shopping/visao/VisaoGeralReal';
import { URL_MOTOR } from '@/lib/shopping/casos';
import {
  agoraDemo,
  diasEntre,
  entradasDia,
  entradasPorHora,
  entradasPorPortaDia,
  formatarNumero,
  ocupacaoAgora,
  rankingZonas,
  somarDias,
  DIAS_SEMANA,
  diaSemana,
  formatarData,
  INICIO_HISTORICO,
} from '@/lib/shopping/demo';
import { um, type Busca } from '@/lib/shopping/filtros';

type Periodo = { chave: string; inicio: string; fim: string; dias: number; rotulo: string };

function periodoDe(sp: Busca, hoje: string): Periodo {
  const chave = um(sp.periodo) ?? 'hoje';
  if (chave === 'ontem') {
    const d = somarDias(hoje, -1);
    return { chave, inicio: d, fim: d, dias: 1, rotulo: `ontem (${formatarData(d)})` };
  }
  if (chave === '7' || chave === '30') {
    const n = Number(chave);
    return { chave, inicio: somarDias(hoje, -(n - 1)), fim: hoje, dias: n, rotulo: `últimos ${n} dias` };
  }
  const de = um(sp.de);
  const ate = um(sp.ate);
  if (chave === 'personalizado' && de && ate && de <= ate) {
    const fim = ate > hoje ? hoje : ate;
    const ini = de < INICIO_HISTORICO ? INICIO_HISTORICO : de;
    return { chave, inicio: ini, fim, dias: diasEntre(ini, fim).length, rotulo: ini === fim ? formatarData(ini) : `${formatarData(ini)} a ${formatarData(fim)}` };
  }
  return { chave: 'hoje', inicio: hoje, fim: hoje, dias: 1, rotulo: 'hoje' };
}

export default async function VisaoGeralPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await exigirAba('visao-geral');
  const agora = agoraDemo();
  const per = periodoDe(await searchParams, agora.data);
  return (
    <div>
      <TituloPagina titulo="Visão geral" descricao="Os números principais do shopping. Com a simulação desligada, saem dos vídeos reais das câmeras; ligada, do shopping inteiro simulado, com filtro de período." />
      <AlternarSimulacao real={<VisaoGeralReal urlMotor={URL_MOTOR} />} simulado={<VisaoSimulada per={per} />} />
    </div>
  );
}

function VisaoSimulada({ per }: { per: Periodo }) {
  const agora = agoraDemo();
  const hoje = agora.data;
  const dias = diasEntre(per.inicio, per.fim);
  const umDia = per.dias === 1;
  const incluiHoje = per.fim === hoje;

  // Período de comparação: um dia -> mesmo dia da semana anterior (até a mesma hora, se for hoje); vários -> período anterior do mesmo tamanho.
  const iniAnt = umDia ? somarDias(per.inicio, -7) : somarDias(per.inicio, -per.dias);
  const fimAnt = umDia ? iniAnt : somarDias(per.inicio, -1);
  const diasAnt = diasEntre(iniAnt, fimAnt);

  const entradas = dias.reduce((s, d) => s + entradasDia(d), 0);
  let entradasAnt = diasAnt.reduce((s, d) => s + entradasDia(d), 0);
  if (umDia && incluiHoje) {
    const horas = entradasPorHora(hoje).filter((h) => h.valor !== null).length;
    entradasAnt = entradasPorHora(iniAnt).slice(0, horas).reduce((s, h) => s + (h.valor ?? 0), 0);
  }

  // Entradas por hora (média do período) e pico
  const porHora = entradasPorHora(per.inicio).map((h, i) => {
    const vals = dias.map((d) => entradasPorHora(d)[i].valor).filter((v): v is number => v !== null);
    return { hora: h.hora, valor: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  const comValor = porHora.filter((h) => h.valor !== null);
  const pico = comValor.reduce((a, b) => ((b.valor ?? 0) > (a.valor ?? 0) ? b : a), comValor[0]);

  const serie = umDia
    ? (() => {
        const a = entradasPorHora(per.inicio);
        const b = entradasPorHora(iniAnt);
        return a.map((h, i) => ({ hora: h.hora, atual: h.valor, anterior: b[i].valor }));
      })()
    : dias.map((d, i) => ({ data: d, atual: Math.round(entradasDia(d)), anterior: diasAnt[i] ? Math.round(entradasDia(diasAnt[i])) : null }));

  const ranking = rankingZonas(per.inicio, per.fim);
  const corredores = Object.entries(
    ranking.reduce<Record<string, number>>((acc, r) => {
      acc[r.zona.corredor] = (acc[r.zona.corredor] ?? 0) + r.total;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const portasMapa = new Map<string, { nome: string; valor: number }>();
  for (const d of dias) for (const p of entradasPorPortaDia(d)) portasMapa.set(p.id, { nome: p.nome, valor: (portasMapa.get(p.id)?.valor ?? 0) + p.valor });
  const portas = [...portasMapa.values()].sort((a, b) => b.valor - a.valor);
  const nomeAnterior = umDia ? `${DIAS_SEMANA[diaSemana(iniAnt)].toLowerCase()} anterior (${formatarData(iniAnt)})` : `${per.dias} dias anteriores`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltroPeriodo atual={per.chave} de={per.inicio} ate={per.fim} hoje={hoje} minimo={INICIO_HISTORICO} />
        <p className="text-xs text-on-surface-variant">
          {umDia ? `${DIAS_SEMANA[diaSemana(per.inicio)]}, ${formatarData(per.inicio)}` : `${formatarData(per.inicio)} a ${formatarData(per.fim)}`}
          {incluiHoje ? ` · atualizado às ${String(agora.hora).padStart(2, '0')}:${String(agora.minuto).padStart(2, '0')}${agora.simulado ? ' (horário simulado)' : ''}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {incluiHoje ? (
          <StatCard label="Pessoas no shopping agora" value={formatarNumero(ocupacaoAgora())} hint="Ocupação estimada" tone="primary" />
        ) : (
          <StatCard label="Média de entradas por dia" value={formatarNumero(entradas / per.dias)} hint={per.rotulo} tone="primary" />
        )}
        <div>
          <StatCard label={umDia ? `Entradas ${per.chave === 'hoje' ? 'hoje' : 'no dia'}` : 'Entradas no período'} value={formatarNumero(entradas)} hint="Contagem por linha nas entradas" />
          <div className="mt-1.5 px-1">
            <Variacao atual={entradas} anterior={entradasAnt} sufixo={`vs. ${nomeAnterior}${umDia && incluiHoje ? ', mesma hora' : ''}`} />
          </div>
        </div>
        <StatCard label={umDia ? 'Horário de pico' : 'Horário de pico (média)'} value={pico ? `${pico.hora}h–${pico.hora + 1}h` : '—'} hint={pico ? `${formatarNumero(pico.valor ?? 0)} entradas nessa hora${umDia ? '' : ' por dia'}` : undefined} />
        <StatCard label="Corredor mais movimentado" value={corredores[0]?.[0] ?? '—'} hint={corredores[0] ? `${formatarNumero(corredores[0][1])} passagens` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo={umDia ? 'Entradas por hora' : 'Entradas por dia'} descricao={`${per.rotulo} x ${nomeAnterior}`} className="xl:col-span-2">
          <GraficoLinhas
            dados={serie}
            x={umDia ? 'hora' : 'data'}
            formatoX={umDia ? 'hora' : 'data'}
            series={[
              { chave: 'atual', nome: umDia ? 'Dia escolhido' : 'Período escolhido', cor: 1 },
              { chave: 'anterior', nome: umDia ? 'Mesmo dia da semana anterior' : 'Período anterior', cor: 2, tracejada: true },
            ]}
          />
        </Secao>
        <Secao titulo="Entradas por acesso" descricao={per.rotulo}>
          <GraficoBarras dados={portas.map((p) => ({ nome: p.nome.replace('Entrada ', ''), valor: p.valor }))} x="nome" series={[{ chave: 'valor', nome: 'Entradas' }]} horizontal altura={240} />
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo="Mapa de calor"
          descricao={per.dias === 1 ? `Onde as pessoas passaram e ficaram · ${per.rotulo}` : `Onde as pessoas passaram e ficaram · último dia do período (${formatarData(per.fim)})`}
          className="xl:col-span-2"
          acao={
            <Link href="/shopping/mapa-calor" className="text-sm font-medium text-primary hover:underline">
              Abrir mapa de calor →
            </Link>
          }
        >
          <CalorVisaoGeral dia={per.fim} />
        </Secao>
        <Secao titulo="Corredores mais movimentados" descricao={`Passagens · ${per.rotulo} (estimativa)`}>
          <Tabela cabecalho={['Corredor', 'Passagens']} alinharDireita={[1]} linhas={corredores.slice(0, 8).map(([c, v]) => [c, formatarNumero(v)])} />
        </Secao>
      </div>
    </div>
  );
}
