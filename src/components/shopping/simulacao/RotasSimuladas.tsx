'use client';

import { useMemo, useState } from 'react';
import { Secao, Tabela } from '@/components/shopping/Comum';
import { GraficoSankey } from '@/components/shopping/Graficos';
import type { Seta } from '@/components/shopping/Planta';
import { SelectField } from '@/components/ui/Field';
import { formatarNumero } from '@/lib/shopping/demo';
import { ENTRADAS, areaPorId, centroArea, type Andar } from '@/lib/shopping/planta';
import { simular } from '@/lib/shopping/simulacao';
import { ControlesRelogio, MapaSimulacao, SeletorAndar, useRelogio } from './MapaSimulacao';

const nome = (id: string) => areaPorId(id)?.nome ?? ENTRADAS.find((e) => e.id === id)?.nome ?? (id === 'escadas' ? 'Escadas rolantes' : id);

function andarDaArea(id: string, outro?: string): Andar | undefined {
  if (id === 'escadas') return outro ? andarDaArea(outro) : undefined; // liga os dois pisos
  if (ENTRADAS.some((e) => e.id === id)) return 'T';
  return areaPorId(id)?.andar;
}

/** Rota = entrada + as 3 primeiras áreas depois dela. */
const chaveRota = (areas: string[]) => areas.slice(0, 4).join('>');

export function RotasSimuladas() {
  const sim = useMemo(() => simular(), []);
  const relogio = useRelogio(540);
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

  const setas: Seta[] = transicoes
    .filter((f) => f.de !== f.para && andarDaArea(f.de, f.para) === andar && andarDaArea(f.para, f.de) === andar)
    .map((f) => ({ de: centroArea(f.de === 'escadas' ? `${andar}-praca` : f.de), para: centroArea(f.para === 'escadas' ? `${andar}-praca` : f.para), valor: f.valor, rotulo: `${nome(f.de)} → ${nome(f.para)}` }))
    .filter((s) => Math.hypot(s.de[0] - s.para[0], s.de[1] - s.para[1]) > 30);
  const sel = rotas.find((r) => r.k === rotaSel);
  const destaque = useMemo(() => (sel ? new Set(sel.ids) : null), [sel]);
  const total = agentes.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Secao
          titulo="Fluxo entre as áreas"
          descricao="Setas = quantas pessoas passaram de uma área para a vizinha no dia (mais grossa = mais gente). Os pontos são os visitantes andando."
          className="xl:col-span-2"
          acao={<SeletorAndar andar={andar} setAndar={setAndar} />}
        >
          <div className="mb-4">
            <ControlesRelogio relogio={relogio} />
          </div>
          <MapaSimulacao sim={sim} andar={andar} relogio={relogio} destaque={destaque} trilhas={!!destaque} planta={{ setas: sel ? [] : setas }} />
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
