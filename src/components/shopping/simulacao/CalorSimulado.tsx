'use client';

import { useMemo, useState } from 'react';
import { Numero, Secao, Tabela } from '@/components/shopping/Comum';
import { formatarNumero } from '@/lib/shopping/demo';
import { AREAS, ZONAS, type Andar } from '@/lib/shopping/planta';
import { horaDoMinuto, sementeDoDia, simular } from '@/lib/shopping/simulacao';
import { ControlesRelogio, MapaSimulacao, SeletorAndar, noShopping, useRelogio } from './MapaSimulacao';

const botao = (ativo: boolean) =>
  `h-8 rounded-sm border px-3 text-xs font-medium transition-colors ${ativo ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`;

export function CalorSimulado() {
  const relogio = useRelogio();
  const sim = useMemo(() => simular([], sementeDoDia(relogio.dia), relogio.dia), [relogio.dia]);
  const [andar, setAndar] = useState<Andar>('T');
  const [modo, setModo] = useState<'dia' | 'hora'>('dia');
  const minuto = Math.floor(relogio.t);

  // Pessoa-minutos por área até agora (ou na última hora).
  const porArea = useMemo(() => {
    const am = sim.amostras;
    const desde = modo === 'hora' ? minuto - 60 : -1;
    const soma = new Map<string, number>();
    for (let i = 0; i < am.t.length && am.t[i] <= minuto; i++) {
      if (am.t[i] <= desde || am.zona[i] < 0) continue;
      const a = ZONAS[am.zona[i]].areaId;
      soma.set(a, (soma.get(a) ?? 0) + 0.5);
    }
    return AREAS.filter((a) => a.tipo !== 'entrada' && a.id !== 'escadas').map((a) => ({ a, v: (soma.get(a.id) ?? 0) * sim.escala }));
  }, [sim, minuto, modo]);

  const agora = noShopping(sim.agentes, minuto) * sim.escala;
  const entradas = sim.agentes.filter((a) => a.chegada <= minuto).length * sim.escala;
  const doAndar = porArea.filter((r) => r.a.andar === andar).sort((x, y) => y.v - x.v);
  const total = doAndar.reduce((s, r) => s + r.v, 0) || 1;
  const maisQuente = [...porArea].sort((x, y) => y.v - x.v)[0];

  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Movimento sobre a planta"
        descricao="Cada ponto é um grupo de visitantes andando pelos corredores. O calor soma onde eles passaram e ficaram: azul = pouco, vermelho = muito."
        acao={<SeletorAndar andar={andar} setAndar={setAndar} />}
      >
        <div className="mb-4">
          <ControlesRelogio relogio={relogio} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setModo('dia')} className={botao(modo === 'dia')}>
            Acumulado do dia
          </button>
          <button onClick={() => setModo('hora')} className={botao(modo === 'hora')}>
            Só a última hora
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <MapaSimulacao sim={sim} andar={andar} relogio={relogio} calor={modo} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
              <span>Pouco</span>
              <span className="h-2.5 w-48 rounded-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #10b981, #facc15, #dc2626)' }} />
              <span>Muito movimento</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-slate-800" /> cada ponto ≈ {sim.escala} visitantes
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <Numero rotulo="No shopping agora" valor={formatarNumero(agora)} detalhe="nos corredores e dentro das lojas" />
            <Numero rotulo={`Entradas até ${horaDoMinuto(minuto)}`} valor={formatarNumero(entradas)} />
            <Numero rotulo="Área mais movimentada" valor={<span className="text-lg">{maisQuente?.a.nome ?? '–'}</span>} detalhe={modo === 'hora' ? 'na última hora' : 'no dia até agora'} />
          </div>
        </div>
      </Secao>

      <Secao titulo={`Áreas do ${andar === 'T' ? 'Térreo' : 'Piso 1'}, da mais para a menos movimentada`} descricao={`${modo === 'hora' ? 'Última hora' : 'Das 10h'} até ${horaDoMinuto(minuto)} · tempo somado das pessoas em cada área`}>
        <Tabela
          cabecalho={['Área', 'Pessoas × minutos', '% do movimento do andar']}
          alinharDireita={[1, 2]}
          linhas={doAndar.map((r) => [
            r.a.nome,
            formatarNumero(r.v),
            <span key="p" className="flex items-center justify-end gap-2">
              <span className="hidden h-1.5 w-28 rounded-full bg-surface-container sm:inline-block">
                <span className="block h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${(100 * r.v) / total}%` }} />
              </span>
              {Math.round((100 * r.v) / total)}%
            </span>,
          ])}
        />
      </Secao>
    </div>
  );
}
