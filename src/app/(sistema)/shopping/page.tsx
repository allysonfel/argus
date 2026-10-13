import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { TituloPagina, Secao, Variacao, Tabela } from '@/components/shopping/Comum';
import { GraficoLinhas, GraficoBarras } from '@/components/shopping/Graficos';
import { Planta } from '@/components/shopping/Planta';
import {
  agoraDemo,
  calorPorZona,
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
} from '@/lib/shopping/demo';

export default function VisaoGeralPage() {
  const agora = agoraDemo();
  const hoje = agora.data;
  const semanaPassada = somarDias(hoje, -7);

  const porHoraHoje = entradasPorHora(hoje);
  const porHoraAnterior = entradasPorHora(semanaPassada);
  const serieHora = porHoraHoje.map((h, i) => ({ hora: h.hora, hoje: h.valor, anterior: porHoraAnterior[i].valor }));

  // Comparação justa: semana passada só até a mesma hora de hoje
  const horasHoje = porHoraHoje.filter((h) => h.valor !== null);
  const entradasHoje = entradasDia(hoje);
  const entradasMesmaHoraAnterior = porHoraAnterior.slice(0, horasHoje.length).reduce((s, h) => s + (h.valor ?? 0), 0);
  const pico = horasHoje.reduce((a, b) => ((b.valor ?? 0) > (a.valor ?? 0) ? b : a), horasHoje[0]);
  const ocupacao = ocupacaoAgora();

  const ranking = rankingZonas(hoje, hoje);
  const corredores = Object.entries(
    ranking.reduce<Record<string, number>>((acc, r) => {
      acc[r.zona.corredor] = (acc[r.zona.corredor] ?? 0) + r.total;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const portas = entradasPorPortaDia(hoje).sort((a, b) => b.valor - a.valor);
  const calor = calorPorZona(hoje, hoje);

  return (
    <div>
      <TituloPagina
        titulo="Visão geral"
        descricao={`${DIAS_SEMANA[diaSemana(hoje)]}, ${formatarData(hoje)} · atualizado às ${String(agora.hora).padStart(2, '0')}:${String(agora.minuto).padStart(2, '0')}${agora.simulado ? ' (horário simulado: o shopping está fechado agora)' : ''}. Todos os números são estimativas a partir das câmeras de corredor.`}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pessoas no shopping agora" value={formatarNumero(ocupacao)} hint="Ocupação estimada" tone="primary" />
        <div>
          <StatCard label="Entradas hoje" value={formatarNumero(entradasHoje)} hint="Contagem por linha nas entradas" />
          <div className="-mt-1 px-1 pt-2">
            <Variacao atual={entradasHoje} anterior={entradasMesmaHoraAnterior} sufixo={`vs. ${DIAS_SEMANA[diaSemana(semanaPassada)].toLowerCase()} passado, mesma hora`} />
          </div>
        </div>
        <StatCard label="Horário de pico (hoje)" value={pico ? `${pico.hora}h–${pico.hora + 1}h` : '—'} hint={pico ? `${formatarNumero(pico.valor ?? 0)} entradas nessa hora` : undefined} />
        <StatCard label="Corredor mais movimentado" value={corredores[0]?.[0].replace('Corredor Principal ', 'Princ. ') ?? '—'} hint={corredores[0] ? `${formatarNumero(corredores[0][1])} passagens hoje` : undefined} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao titulo="Entradas por hora" descricao={`Hoje x ${DIAS_SEMANA[diaSemana(semanaPassada)].toLowerCase()} passado (${formatarData(semanaPassada)})`} className="xl:col-span-2">
          <GraficoLinhas
            dados={serieHora}
            x="hora"
            series={[
              { chave: 'hoje', nome: 'Hoje', cor: 1 },
              { chave: 'anterior', nome: 'Mesmo dia da semana passada', cor: 2, tracejada: true },
            ]}
          />
        </Secao>
        <Secao titulo="Entradas por acesso" descricao="Hoje, até agora">
          <GraficoBarras dados={portas.map((p) => ({ nome: p.nome.replace('Entrada ', ''), valor: p.valor }))} x="nome" series={[{ chave: 'valor', nome: 'Entradas' }]} horizontal altura={240} />
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo="Movimento agora no Térreo"
          descricao="Densidade de passagens hoje por área de corredor"
          className="xl:col-span-2"
          acao={
            <Link href="/shopping/mapa-calor" className="text-sm font-medium text-primary hover:underline">
              Abrir mapa de calor →
            </Link>
          }
        >
          <Planta andar="T" valores={calor} />
        </Secao>
        <Secao titulo="Corredores mais movimentados" descricao="Passagens hoje (estimativa)">
          <Tabela
            cabecalho={['Corredor', 'Passagens']}
            alinharDireita={[1]}
            linhas={corredores.slice(0, 8).map(([c, v]) => [c, formatarNumero(v)])}
          />
        </Secao>
      </div>
    </div>
  );
}
