'use client';

import { useEffect, useState } from 'react';
import { BotaoCSV } from '@/components/shopping/BotaoCSV';
import { Numero, Secao, Variacao } from '@/components/shopping/Comum';
import { formatarData, formatarNumero } from '@/lib/shopping/demo';
import { ENTRADAS, areaPorId } from '@/lib/shopping/planta';
import { PERIODOS_ROTA, resumoRotas, type PeriodoRota, type ResumoRotas } from '@/lib/shopping/resumoRotas';
import { cn } from '@/lib/cn';

const nome = (id: string) => areaPorId(id)?.nome ?? ENTRADAS.find((e) => e.id === id)?.nome ?? (id === 'escadas' ? 'Escadas rolantes' : id);
const pct = (v: number) => `${Math.round(v)}%`;

/** "De quem entra por cada porta, para onde vai", somado por dia, semana, mês, trimestre, semestre ou ano. */
export function ResumoRotasPeriodo({ fim }: { fim: string }) {
  const [periodo, setPeriodo] = useState<PeriodoRota>('semana');
  const [resumo, setResumo] = useState<ResumoRotas | null>(null);
  const [calculando, setCalculando] = useState(true);

  useEffect(() => {
    setCalculando(true);
    // Deixa a tela mostrar "calculando" antes de simular os dias do período.
    const t = setTimeout(() => {
      setResumo(resumoRotas(fim, periodo));
      setCalculando(false);
    }, 30);
    return () => clearTimeout(t);
  }, [fim, periodo]);

  const nomePeriodo = PERIODOS_ROTA.find((p) => p.id === periodo)!.nome;
  const linhasCSV = (resumo?.entradas ?? []).flatMap((e) =>
    e.destinos.map((d) => [nome(e.entrada), Math.round(e.pessoas), d.caminho.map(nome).join(' → ') || 'Saiu sem ir além do hall', Math.round(d.pessoas), Math.round(d.pct)]),
  );

  return (
    <Secao
      titulo="Resumo de rotas por período"
      descricao="De quem entra por cada porta, para onde vai depois do hall de entrada (as duas áreas seguintes). Mude o dia no relógio do mapa para mudar o fim do período."
      acao={
        <div className="flex flex-wrap rounded-md bg-surface-container p-1">
          {PERIODOS_ROTA.map((p) => (
            <button key={p.id} onClick={() => setPeriodo(p.id)} className={cn('h-8 rounded px-3 text-sm font-medium transition-colors', periodo === p.id ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}>
              {p.nome}
            </button>
          ))}
        </div>
      }
    >
      {!resumo ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">Calculando as rotas do período…</p>
      ) : (
        <div className={cn('flex flex-col gap-5 transition-opacity', calculando && 'opacity-50')}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-8">
              <Numero
                rotulo={`Pessoas no período (${nomePeriodo.toLowerCase()})`}
                valor={formatarNumero(resumo.pessoas)}
                detalhe={resumo.dias === 1 ? formatarData(resumo.fim) : `${formatarData(resumo.inicio)} a ${formatarData(resumo.fim)} · ${resumo.dias} dias`}
              />
              <Numero rotulo="Média por dia" valor={formatarNumero(resumo.pessoas / resumo.dias)} detalhe={<Variacao atual={resumo.pessoas} anterior={resumo.anterior} />} />
              <Numero rotulo="Porta mais usada" valor={nome(resumo.entradas[0].entrada).replace('Entrada ', '')} detalhe={`${pct(resumo.entradas[0].pct)} de quem entrou`} />
            </div>
            <BotaoCSV
              nomeArquivo={`rotas-${periodo}-${resumo.fim}.csv`}
              cabecalho={['Entrada', 'Pessoas que entraram', 'Para onde foram', 'Pessoas', '% de quem entrou pela porta']}
              linhas={linhasCSV}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resumo.entradas.map((e) => (
              <div key={e.entrada} className="rounded-md border border-outline-variant p-4">
                <div className="mb-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-on-surface">{nome(e.entrada)}</p>
                    <p className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                      {formatarNumero(e.pessoas)} · {pct(e.pct)}
                    </p>
                  </div>
                  {e.hall && <p className="text-xs text-on-surface-variant">Entra por {nome(e.hall)} e depois vai para:</p>}
                </div>
                <ul className="flex flex-col gap-2.5">
                  {e.destinos.map((d) => (
                    <li key={d.caminho.join('>')} className="text-sm">
                      <div className="mb-1 flex justify-between gap-3">
                        <span className="text-on-surface">{d.caminho.length ? d.caminho.map(nome).join(' → ') : 'Saiu sem ir além do hall'}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-on-surface">{pct(d.pct)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-container">
                        <div className="h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${d.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant">
            Estimativa da simulação: cada dia da semana do período é simulado uma vez e vale para os dias iguais, pesado pelo movimento de cada dia. Com as câmeras do shopping ligadas, o resumo sai das rotas gravadas de cada dia.
          </p>
        </div>
      )}
    </Secao>
  );
}
