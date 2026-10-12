'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CAMERAS, CINEMA, ENTRADAS, ESCADAS, LOJAS, ZONAS, type Andar } from '@/lib/shopping/planta';

// Escala sequencial de um matiz só (azul, claro -> escuro), da paleta de
// referência do guia de visualização. Claro = pouco movimento.
export const RAMPA_SEQUENCIAL = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
// Divergente (abaixo da média = vermelho, média = cinza, acima = azul)
const DIVERGENTE_NEG = ['#e34948', '#ec8786', '#f3bdbc'];
const DIVERGENTE_POS = ['#b7d3f6', '#6da7ec', '#2a78d6'];

export function corSequencial(v: number, min: number, max: number): string {
  const t = max > min ? (v - min) / (max - min) : 0;
  return RAMPA_SEQUENCIAL[Math.min(RAMPA_SEQUENCIAL.length - 1, Math.max(0, Math.floor(t * RAMPA_SEQUENCIAL.length)))];
}

/** Índice relativo à média (1 = na média). */
export function corDivergente(indice: number): string {
  if (indice < 0.4) return DIVERGENTE_NEG[0];
  if (indice < 0.7) return DIVERGENTE_NEG[1];
  if (indice < 0.9) return DIVERGENTE_NEG[2];
  if (indice <= 1.1) return 'var(--viz-neutro)';
  if (indice <= 1.4) return DIVERGENTE_POS[0];
  if (indice <= 1.8) return DIVERGENTE_POS[1];
  return DIVERGENTE_POS[2];
}

export type Seta = { de: [number, number]; para: [number, number]; valor: number; rotulo?: string };
export type Marcador = { x: number; y: number; rotulo: string; tom?: 'alerta' | 'info' | 'ok' };

type Props = {
  andar: Andar;
  valores?: Record<string, number>;
  modo?: 'sequencial' | 'divergente';
  formatarValor?: 'densidade' | 'indice' | 'pessoas';
  destaque?: string[];
  selecionada?: string;
  linkZona?: string; // ex.: "/shopping/corredores?zona=" (o id da zona é concatenado)
  setas?: Seta[];
  marcadores?: Marcador[];
  mostrarCameras?: boolean;
  lojaDestacada?: string;
};

function textoValor(v: number, f: Props['formatarValor']): string {
  if (f === 'indice') return `${Math.round(v * 100)}% da média do andar`;
  if (f === 'pessoas') return `${Math.round(v).toLocaleString('pt-BR')} pessoas`;
  return `${v.toFixed(1)} passagens/dia por 1.000 px²`;
}

export function Planta({ andar, valores, modo = 'sequencial', formatarValor = 'densidade', destaque = [], selecionada, linkZona, setas = [], marcadores = [], mostrarCameras, lojaDestacada }: Props) {
  const [hover, setHover] = useState<{ x: number; y: number; texto: string[] } | null>(null);
  const zonas = ZONAS.filter((z) => z.andar === andar);
  const vals = zonas.map((z) => valores?.[z.id] ?? 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const maxSeta = Math.max(1, ...setas.map((s) => s.valor));

  function cor(zId: string): string {
    if (!valores) return 'var(--viz-corredor)';
    const v = valores[zId] ?? 0;
    return modo === 'divergente' ? corDivergente(v) : corSequencial(v, min, max);
  }

  return (
    <div className="relative">
      <svg viewBox="0 0 1000 560" className="block h-auto w-full select-none" role="img" aria-label={`Planta do ${andar === 'T' ? 'Térreo' : 'Piso 1'}`}>
        <rect x="0" y="0" width="1000" height="560" fill="var(--viz-fundo)" rx="6" />

        {/* Lojas (não monitoradas por dentro: só contorno) */}
        {LOJAS.filter((l) => l.andar === andar).map((l) => (
          <g key={l.id}>
            <rect x={l.rect.x} y={l.rect.y} width={l.rect.w} height={l.rect.h} rx="3" fill={l.id === lojaDestacada ? 'var(--viz-loja-destaque)' : 'var(--viz-loja)'} stroke="var(--viz-linha)" strokeWidth={l.id === lojaDestacada ? 2.5 : 1} />
            <text x={l.rect.x + l.rect.w / 2} y={l.rect.y + l.rect.h / 2 - 4} textAnchor="middle" className="fill-[var(--viz-texto)] text-[13px] font-semibold">
              {l.nome}
            </text>
            <text x={l.rect.x + l.rect.w / 2} y={l.rect.y + l.rect.h / 2 + 10} textAnchor="middle" className="fill-[var(--viz-texto-sec)] text-[10px]">
              {l.categoria}
            </text>
          </g>
        ))}

        {andar === 'P1' && (
          <g>
            <rect x={CINEMA.x} y={CINEMA.y} width={CINEMA.w} height={CINEMA.h} rx="3" fill="var(--viz-loja)" stroke="var(--viz-linha)" />
            <text x={CINEMA.x + CINEMA.w / 2} y={CINEMA.y + CINEMA.h / 2 + 4} textAnchor="middle" className="fill-[var(--viz-texto)] text-[12px] font-semibold">
              Cinema
            </text>
          </g>
        )}

        {/* Zonas de corredor (as únicas áreas monitoradas) */}
        {zonas.map((z) => {
          const v = valores?.[z.id];
          const conteudo = (
            <rect
              x={z.rect.x}
              y={z.rect.y}
              width={z.rect.w}
              height={z.rect.h}
              fill={cor(z.id)}
              stroke={z.id === selecionada ? 'var(--viz-selecao)' : destaque.includes(z.id) ? '#d03b3b' : 'var(--viz-fundo)'}
              strokeWidth={z.id === selecionada || destaque.includes(z.id) ? 4 : 2}
              className={linkZona ? 'cursor-pointer' : undefined}
              onMouseMove={(e) => {
                const svg = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
                setHover({ x: e.clientX - svg.left, y: e.clientY - svg.top, texto: [z.nome, v !== undefined ? textoValor(v, formatarValor) : z.corredor] });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
          return linkZona ? (
            <Link key={z.id} href={`${linkZona}${z.id}`}>
              {conteudo}
            </Link>
          ) : (
            <g key={z.id}>{conteudo}</g>
          );
        })}

        {ESCADAS.filter((e) => e.andar === andar).map((e, i) => (
          <g key={i} pointerEvents="none">
            <rect x={e.rect.x} y={e.rect.y} width={e.rect.w} height={e.rect.h} rx="3" fill="none" stroke="var(--viz-texto-sec)" strokeDasharray="4 3" />
            <text x={e.rect.x + e.rect.w / 2} y={e.rect.y + e.rect.h / 2 + 4} textAnchor="middle" className="fill-[var(--viz-texto-sec)] text-[9px]">
              escadas
            </text>
          </g>
        ))}

        {andar === 'T' &&
          ENTRADAS.map((e) => (
            <g key={e.id}>
              <rect x={e.rect.x} y={e.rect.y} width={e.rect.w} height={e.rect.h} rx="3" fill="var(--viz-entrada)" />
              <text
                x={e.rect.x + e.rect.w / 2}
                y={e.rect.y + e.rect.h / 2 + 4}
                textAnchor="middle"
                className="fill-white text-[10px] font-semibold"
                transform={e.rect.h > e.rect.w ? `rotate(-90 ${e.rect.x + e.rect.w / 2} ${e.rect.y + e.rect.h / 2})` : undefined}
              >
                {e.nome.replace('Entrada ', '')}
              </text>
            </g>
          ))}


        <defs>
          <marker id="ponta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="var(--viz-seta)" />
          </marker>
        </defs>

        {setas.map((s, i) => {
          const [x1, y1] = s.de;
          const [x2, y2] = s.para;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          // desloca levemente pra direita do sentido (ida e volta não se sobrepõem)
          const ox = (-dy / len) * 9;
          const oy = (dx / len) * 9;
          const larg = 2 + (s.valor / maxSeta) * 12;
          return (
            <line
              key={i}
              x1={x1 + ox + (dx / len) * 22}
              y1={y1 + oy + (dy / len) * 22}
              x2={x2 + ox - (dx / len) * 26}
              y2={y2 + oy - (dy / len) * 26}
              stroke="var(--viz-seta)"
              strokeOpacity="0.85"
              strokeWidth={larg}
              strokeLinecap="round"
              markerEnd="url(#ponta)"
              onMouseMove={(e) => {
                const svg = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
                setHover({ x: e.clientX - svg.left, y: e.clientY - svg.top, texto: [s.rotulo ?? 'Fluxo', `${s.valor.toLocaleString('pt-BR')} pessoas/dia (estimativa)`] });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        {mostrarCameras &&
          CAMERAS.filter((c) => c.andar === andar).map((c) => (
            <g key={c.id} pointerEvents="none">
              <circle cx={c.x} cy={c.y} r="6" fill="var(--viz-fundo)" stroke="var(--viz-texto)" strokeWidth="2" />
              <circle cx={c.x} cy={c.y} r="2" fill="var(--viz-texto)" />
            </g>
          ))}

        {marcadores.map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r="16" fill={m.tom === 'alerta' ? '#d03b3b' : m.tom === 'ok' ? '#0ca30c' : '#2a78d6'} opacity="0.25">
              <animate attributeName="r" values="10;20;10" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={m.x} cy={m.y} r="7" fill={m.tom === 'alerta' ? '#d03b3b' : m.tom === 'ok' ? '#0ca30c' : '#2a78d6'} stroke="var(--viz-fundo)" strokeWidth="2" />
            <text x={m.x + 12} y={m.y - 10} className="fill-[var(--viz-texto)] text-[11px] font-semibold">
              {m.rotulo}
            </text>
          </g>
        ))}
      </svg>

      {hover && (
        <div className="pointer-events-none absolute z-10 max-w-64 rounded-sm border border-outline-variant bg-surface px-3 py-2 text-xs shadow-sm" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <p className="font-semibold text-on-surface">{hover.texto[0]}</p>
          {hover.texto.slice(1).map((t, i) => (
            <p key={i} className="text-on-surface-variant">
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function LegendaSequencial({ rotuloMin, rotuloMax, titulo }: { rotuloMin: string; rotuloMax: string; titulo: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
      <span>{titulo}</span>
      <span>{rotuloMin}</span>
      <span className="flex h-2.5 w-48 overflow-hidden rounded-full">
        {RAMPA_SEQUENCIAL.map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
      </span>
      <span>{rotuloMax}</span>
    </div>
  );
}

export function LegendaDivergente() {
  const itens = [
    ['#e34948', '< 40% da média'],
    ['#ec8786', '40–70%'],
    ['#f3bdbc', '70–90%'],
    ['var(--viz-neutro)', 'na média'],
    ['#b7d3f6', '110–140%'],
    ['#6da7ec', '140–180%'],
    ['#2a78d6', '> 180%'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
      {itens.map(([c, t]) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
          {t}
        </span>
      ))}
    </div>
  );
}
