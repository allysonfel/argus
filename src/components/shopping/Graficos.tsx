'use client';

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis, Layer, Rectangle } from 'recharts';

// Gráficos do painel do shopping. Cores por PAPEL (var(--serie-N)), na
// ordem fixa da paleta; um só eixo Y; grade e eixos discretos; tooltip
// em todo gráfico; legenda sempre que houver 2+ séries.

export type Serie = { chave: string; nome: string; cor?: 1 | 2 | 3; tracejada?: boolean };

const fmt = (v: unknown) => (typeof v === 'number' ? Math.round(v).toLocaleString('pt-BR') : String(v ?? '—'));
const eixo = { stroke: 'var(--viz-eixo)', fontSize: 12, tickLine: false, axisLine: false } as const;

function CaixaTooltip({ active, payload, label, rotuloX }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number; rotuloX?: (v: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-outline-variant bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-on-surface">{rotuloX && label !== undefined ? rotuloX(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-on-surface-variant">
          <span className="inline-block h-0.5 w-3" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums text-on-surface">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const ROTULOS_X: Record<string, (v: string | number) => string> = {
  hora: (v) => `${v}h`,
  data: (v) => {
    const [, m, d] = String(v).split('-');
    return `${d}/${m}`;
  },
  dia: (v) => `Dia ${v}`,
};

export function GraficoLinhas({ dados, x, series, altura = 280, formatoX = 'hora' }: { dados: Record<string, unknown>[]; x: string; series: Serie[]; altura?: number; formatoX?: keyof typeof ROTULOS_X }) {
  const rotuloX = ROTULOS_X[formatoX];
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--viz-grade)" vertical={false} />
        <XAxis dataKey={x} {...eixo} tickFormatter={rotuloX} minTickGap={16} />
        <YAxis {...eixo} tickFormatter={fmt} width={56} />
        <Tooltip content={<CaixaTooltip rotuloX={rotuloX} />} cursor={{ stroke: 'var(--viz-eixo)', strokeDasharray: '3 3' }} />
        {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome}
            stroke={`var(--serie-${s.cor ?? i + 1})`}
            strokeWidth={2}
            strokeDasharray={s.tracejada ? '5 4' : undefined}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--viz-fundo)' }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoBarras({ dados, x, series, altura = 260, horizontal = false, formatoX }: { dados: Record<string, unknown>[]; x: string; series: Serie[]; altura?: number; horizontal?: boolean; formatoX?: keyof typeof ROTULOS_X }) {
  const rotuloX = formatoX ? ROTULOS_X[formatoX] : undefined;
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 8 : 0 }} barCategoryGap="25%">
        <CartesianGrid stroke="var(--viz-grade)" vertical={horizontal} horizontal={!horizontal} />
        {/* Recharts 2 não enxerga eixos dentro de fragmentos: um elemento por condição */}
        {horizontal && <XAxis type="number" {...eixo} tickFormatter={fmt} />}
        {horizontal && <YAxis type="category" dataKey={x} {...eixo} width={170} />}
        {!horizontal && <XAxis dataKey={x} {...eixo} tickFormatter={rotuloX} />}
        {!horizontal && <YAxis {...eixo} tickFormatter={fmt} width={56} />}
        <Tooltip content={<CaixaTooltip rotuloX={rotuloX} />} cursor={{ fill: 'var(--viz-grade)', opacity: 0.5 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={`var(--serie-${s.cor ?? i + 1})`} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

type NoSankey = { name: string };
type LigacaoSankey = { source: number; target: number; value: number };

function NoSankeyDesenho(props: { x: number; y: number; width: number; height: number; index: number; payload: { name: string; value: number } }) {
  const { x, y, width, height, payload } = props;
  // 1ª coluna: rótulo à direita do nó; demais: à esquerda (não sai da área do gráfico)
  const direita = x > 100;
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill="var(--serie-1)" radius={2} />
      <text x={direita ? x - 6 : x + width + 6} y={y + height / 2} textAnchor={direita ? 'end' : 'start'} dominantBaseline="middle" fontSize={12} fill="var(--viz-texto)">
        {payload.name} · {Math.round(payload.value).toLocaleString('pt-BR')}
      </text>
    </Layer>
  );
}

export function GraficoSankey({ nos, ligacoes, altura = 420 }: { nos: NoSankey[]; ligacoes: LigacaoSankey[]; altura?: number }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <Sankey
        data={{ nodes: nos, links: ligacoes }}
        nodePadding={18}
        nodeWidth={10}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        link={{ stroke: 'var(--serie-1)', strokeOpacity: 0.25 }}
        node={<NoSankeyDesenho x={0} y={0} width={0} height={0} index={0} payload={{ name: '', value: 0 }} />}
      >
        <Tooltip content={<CaixaTooltip />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
