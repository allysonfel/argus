'use client';

import { useMemo, useState } from 'react';
import { Secao, Tabela } from '@/components/shopping/Comum';
import { GraficoSankey } from '@/components/shopping/Graficos';
import type { Seta } from '@/components/shopping/Planta';
import { SelectField } from '@/components/ui/Field';
import { formatarNumero } from '@/lib/shopping/demo';
import { ENTRADAS, areaPorId, centro, zonaPorId, type Andar } from '@/lib/shopping/planta';
import { sementeDoDia, simular } from '@/lib/shopping/simulacao';
import { ControlesRelogio, MapaSimulacao, SeletorAndar, useRelogio } from './MapaSimulacao';
import { ResumoRotasPeriodo } from './ResumoRotasPeriodo';

const nome = (id: string) => areaPorId(id)?.nome ?? ENTRADAS.find((e) => e.id === id)?.nome ?? (id === 'escadas' ? 'Escadas rolantes' : id);


/** Rota = entrada + as 3 primeiras áreas depois dela. */
const chaveRota = (areas: string[]) => areas.slice(0, 4).join('>');

export function RotasSimuladas() {
  const relogio = useRelogio();
  const sim = useMemo(() => simular([], sementeDoDia(relogio.dia), relogio.dia), [relogio.dia]);
  const [andar, setAndar] = useState<Andar>('T');
  const [entrada, setEntrada] = useState('');
  const [rotaSel, setRotaSel] = useState<string | null>(null);

  const agentes = useMemo(() => sim.agentes.filter((a) => !entrada || a.entrada === entrada), [sim, entrada]);

  const { transicoes, rotas, nos, ligacoes } = useMemo(() => {
    const trans = new Map<string, number>();
    const rot = new Map<string, number[]>();
    for (const a of agentes) {
      for (let i = 0; i < a.areas.length - 1; i++) {
        const k = `${a.areas[i]}>${a.areas[i + 1]}`;
        trans.set(k, (trans.get(k) ?? 0) + 1);
      }
      const k = chaveRota(a.areas);
      rot.set(k, [...(rot.get(k) ?? []), a.id]);
    }
    // Sankey em 3 níveis: entrada → 1ª área → 2ª área.
    const nos: { name: string }[] = [];
    const idx = new Map<string, number>();
    const no = (nivel: number, area: string) => {
      const k = `${nivel}|${area}`;
      if (!idx.has(k)) {
        idx.set(k, nos.length);
        nos.push({ name: nome(area) });
      }
      return idx.get(k)!;
    };
    const lig = new Map<string, number>();
    for (const a of agentes)
      for (let i = 0; i < Math.min(2, a.areas.length - 1); i++) {
        const k = `${no(i, a.areas[i])}>${no(i + 1, a.areas[i + 1])}`;
        lig.set(k, (lig.get(k) ?? 0) + sim.escala);
      }
    return {
      transicoes: [...trans].map(([k, v]) => ({ de: k.split('>')[0], para: k.split('>')[1], valor: v * sim.escala })).sort((a, b) => b.valor - a.valor),
      rotas: [...rot].map(([k, ids]) => ({ k, ids })).sort((a, b) => b.ids.length - a.ids.length),
      nos,
      ligacoes: [...lig].map(([k, v]) => ({ source: Number(k.split('>')[0]), target: Number(k.split('>')[1]), value: v })),
    };
  }, [agentes, sim.escala]);

  // Setas só nas portas do shopping: quem entra (pra dentro) e quem sai (pra fora).
  const setas: Seta[] = ENTRADAS.filter((e) => e.andar === andar).flatMap((e) => {
    const [ex, ey] = centro(e.rect);
    const [zx, zy] = centro(zonaPorId(e.zonaId)!.rect);
    const len = Math.hypot(zx - ex, zy - ey) || 1;
    const ux = (zx - ex) / len;
    const uy = (zy - ey) / len;
    const fora: [number, number] = [ex - ux * 55, ey - uy * 55];
    const dentro: [number, number] = [ex + ux * 10, ey + uy * 10];
    const entraram = agentes.filter((a) => a.entrada === e.id).length * sim.escala;
    const sairam = agentes.filter((a) => a.saidaPor === e.id).length * sim.escala;
    const n = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} mil` : String(v));
    return [
      { de: fora, para: dentro, valor: entraram, rotulo: `Entraram pela ${e.nome}`, etiqueta: `↓ ${n(entraram)}` },
      { de: dentro, para: fora, valor: sairam, rotulo: `Saíram pela ${e.nome}`, etiqueta: `↑ ${n(sairam)}`, cor: 'saida' },
    ];
  });
  const sel = rotas.find((r) => r.k === rotaSel);
  const destaque = useMemo(() => (sel ? new Set(sel.ids) : null), [sel]);
  const total = agentes.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo="Entradas, saídas e movimento"
          descricao="Em cada porta do shopping: laranja = quantas pessoas entraram, azul = quantas saíram no dia. Os pontos são os visitantes andando, com o rastro do caminho."
          className="xl:col-span-2"
          acao={<SeletorAndar andar={andar} setAndar={setAndar} />}
        >
          <div className="mb-4">
            <ControlesRelogio relogio={relogio} />
          </div>
          <MapaSimulacao sim={sim} andar={andar} relogio={relogio} destaque={destaque} trilhas={!!destaque} rastro planta={{ setas: sel ? [] : setas }} />
          {sel && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Em azul: quem fez a rota escolhida, com o caminho. <button onClick={() => setRotaSel(null)} className="font-medium text-primary hover:underline">Mostrar todos</button>
            </p>
          )}
        </Secao>

        <Secao titulo="Rotas mais comuns" descricao="Da entrada até a 3ª área visitada. Clique para ver no mapa.">
          <SelectField label="Entrada" value={entrada} onChange={(e) => { setEntrada(e.target.value); setRotaSel(null); }} className="mb-4">
            <option value="">Todas as entradas</option>
            {ENTRADAS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </SelectField>
          <ol className="flex flex-col gap-3">
            {rotas.slice(0, 7).map((r) => (
              <li key={r.k}>
                <button onClick={() => setRotaSel(r.k === rotaSel ? null : r.k)} className={`w-full rounded-sm p-1.5 text-left text-sm transition-colors ${r.k === rotaSel ? 'bg-primary-container' : 'hover:bg-surface-container-low'}`}>
                  <div className="mb-1 flex justify-between gap-3">
                    <span className="text-on-surface">{r.k.split('>').map(nome).join(' → ')}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-variant">{Math.round((100 * r.ids.length) / total)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-container">
                    <div className="h-1.5 rounded-full bg-[var(--serie-1)]" style={{ width: `${(100 * r.ids.length) / rotas[0].ids.length}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-on-surface-variant">≈ {formatarNumero(r.ids.length * sim.escala)} pessoas no dia</p>
                </button>
              </li>
            ))}
          </ol>
        </Secao>
      </div>

      <ResumoRotasPeriodo fim={relogio.dia} />

      <Secao titulo="De onde vêm e para onde vão (diagrama de Sankey)" descricao="Da entrada até a 2ª área visitada · pessoas no dia">
        <GraficoSankey nos={nos} ligacoes={ligacoes} altura={460} />
      </Secao>

      <Secao titulo="Passagens entre áreas" descricao="Pessoas no dia que foram de uma área direto para a outra">
        <div className="max-h-96 overflow-y-auto">
          <Tabela cabecalho={['De', 'Para', 'Pessoas']} alinharDireita={[2]} linhas={transicoes.slice(0, 30).map((f) => [nome(f.de), nome(f.para), formatarNumero(f.valor)])} />
        </div>
      </Secao>
    </div>
  );
}
