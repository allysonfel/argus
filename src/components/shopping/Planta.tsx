'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CAMERAS, ENTRADAS, ESCADAS, FUNDO, LOJAS, ZONAS, type Andar } from '@/lib/shopping/planta';
import { ESBOCO, type Poligono } from '@/lib/shopping/plantaEsboco';

const caminho = (p: Poligono) => p.map((a) => `M${a.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('');

/** Ponto dentro de um polígono (só o anel externo). */
function dentroDe([x, y]: [number, number], p: Poligono): boolean {
  let d = false;
  const a = p[0];
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i];
    const [xj, yj] = a[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function centroide(p: Poligono): [number, number] {
  const a = p[0];
  return [a.reduce((s, q) => s + q[0], 0) / a.length, a.reduce((s, q) => s + q[1], 0) / a.length];
}

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

// etiqueta: número curto desenhado no começo da seta (ex.: "1.234").
export type Seta = { de: [number, number]; para: [number, number]; valor: number; rotulo?: string; etiqueta?: string; cor?: string };
export type EstiloMapa = 'planta' | 'mapa';
export type Marcador = { x: number; y: number; rotulo: string; tom?: 'alerta' | 'info' | 'ok' };

type Props = {
  andar: Andar;
  valores?: Record<string, number>;
  modo?: 'sequencial' | 'divergente';
  formatarValor?: 'densidade' | 'indice' | 'pessoas';
  destaque?: string[];
  selecionada?: string;
  linkZona?: string; // prefixo do link de cada zona (o id da zona é concatenado)
  setas?: Seta[];
  marcadores?: Marcador[];
  mostrarCameras?: boolean;
  lojaDestacada?: string;
  aoClicarZona?: (id: string) => void;
  /** Visão do mapa: 'planta' = imagem oficial; 'mapa' = desenho limpo. */
  estilo?: EstiloMapa;
  /** Mostra o botão de trocar a visão no canto (começa em `estilo`). */
  trocarVisao?: boolean;
};

function textoValor(v: number, f: Props['formatarValor']): string {
  if (f === 'indice') return `${Math.round(v * 100)}% da média do andar`;
  if (f === 'pessoas') return `${Math.round(v).toLocaleString('pt-BR')} pessoas`;
  return `${v.toFixed(1)} passagens/dia por 1.000 px²`;
}

/** Nome das âncoras no meio da loja onde elas ficam. */
function NomesAncoras({ andar }: { andar: Andar }) {
  return (
    <>
      {LOJAS.filter((l) => l.andar === andar && (l.atracao > 1 || l.nome === 'Centerplex')).map((l) => {
        const c: [number, number] = [l.rect.x + l.rect.w / 2, l.rect.y + l.rect.h / 2];
        const poli = ESBOCO[andar].lojas.find((p) => dentroDe(c, p));
        const [x, y] = poli ? centroide(poli) : c;
        const nome = l.nome.length > 22 ? l.nome.split(' · ')[0] : l.nome;
        return (
          <text key={l.id} x={x} y={y + 3} textAnchor="middle" className="pointer-events-none fill-[var(--viz-texto)] text-[9px] font-semibold uppercase tracking-wide">
            {nome}
          </text>
        );
      })}
    </>
  );
}

export function Planta({ andar, valores, modo = 'sequencial', formatarValor = 'densidade', destaque = [], selecionada, linkZona, setas = [], marcadores = [], mostrarCameras, lojaDestacada, aoClicarZona, estilo: estiloInicial = 'planta', trocarVisao }: Props) {
  const [estiloEscolhido, setEstilo] = useState<EstiloMapa | null>(null);
  const estilo = (trocarVisao && estiloEscolhido) || estiloInicial;
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

        {estilo !== 'mapa' && (
          /* Planta oficial do shopping de fundo (as lojas já vêm com nome nela) */
          <image href={FUNDO[andar].src} x={FUNDO[andar].x} y={FUNDO[andar].y} width={FUNDO[andar].w} height={FUNDO[andar].h} preserveAspectRatio="none" />
        )}
        {estilo === 'mapa' && (
          /* Mapa: prédio, lojas, corredores e estacionamento extraídos da planta oficial */
          <g>
            <defs>
              <pattern id="estac" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill="var(--viz-corredor)" />
                <line x1="0" y1="0" x2="0" y2="8" stroke="var(--viz-linha)" strokeWidth="2" />
              </pattern>
            </defs>
            {ESBOCO[andar].contorno.map((p, i) => (
              <path key={`c${i}`} d={caminho(p)} fill="var(--viz-loja)" stroke="var(--viz-linha)" strokeWidth="1.5" fillRule="evenodd" />
            ))}
            {ESBOCO[andar].estacionamento.map((p, i) => (
              <path key={`e${i}`} d={caminho(p)} fill="url(#estac)" stroke="var(--viz-linha)" fillRule="evenodd" />
            ))}
            {ESBOCO[andar].lojas.map((p, i) => (
              <path key={`l${i}`} d={caminho(p)} fill="var(--viz-neutro)" stroke="var(--viz-fundo)" strokeWidth="1.2" />
            ))}
            {ESBOCO[andar].corredores.map((p, i) => (
              <path key={`r${i}`} d={caminho(p)} fill="var(--viz-fundo)" stroke="var(--viz-linha)" strokeWidth="0.8" fillRule="evenodd" />
            ))}
            <NomesAncoras andar={andar} />
          </g>
        )}
        {lojaDestacada &&
          LOJAS.filter((l) => l.id === lojaDestacada && l.andar === andar).map((l) => (
            <rect key={l.id} x={l.rect.x} y={l.rect.y} width={l.rect.w} height={l.rect.h} rx="3" fill="var(--viz-loja-destaque)" fillOpacity="0.35" stroke="var(--viz-selecao)" strokeWidth="2.5" />
          ))}

        {/* Zonas de corredor (as únicas áreas monitoradas) */}
        {zonas.map((z) => {
          const v = valores?.[z.id];
          const conteudo = (
            <rect
              x={z.rect.x}
              y={z.rect.y}
              width={z.rect.w}
              height={z.rect.h}
              rx="3"
              fill={valores ? cor(z.id) : estilo === 'mapa' ? 'var(--viz-corredor)' : 'rgba(37, 99, 235, 0.08)'}
              fillOpacity={valores ? (estilo === 'mapa' ? 1 : 0.78) : 1}
              stroke={z.id === selecionada ? 'var(--viz-selecao)' : destaque.includes(z.id) ? '#d03b3b' : estilo === 'mapa' ? 'var(--viz-corredor)' : 'rgba(37, 99, 235, 0.35)'}
              strokeWidth={z.id === selecionada || destaque.includes(z.id) ? 3 : 1}
              className={linkZona || aoClicarZona ? 'cursor-pointer' : undefined}
              onClick={aoClicarZona ? () => aoClicarZona(z.id) : undefined}
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
            <rect x={e.rect.x} y={e.rect.y} width={e.rect.w} height={e.rect.h} rx="3" fill="rgba(255,255,255,0.75)" stroke="#334155" strokeDasharray="4 3" />
            <text x={e.rect.x + e.rect.w / 2} y={e.rect.y + e.rect.h / 2 + 4} textAnchor="middle" className="fill-slate-700 text-[8px] font-semibold">
              escada
            </text>
          </g>
        ))}

        {ENTRADAS.filter((e) => e.andar === andar).map((e) => (
            <g key={e.id}>
              <rect x={e.rect.x} y={e.rect.y} width={e.rect.w} height={e.rect.h} rx="3" fill="var(--viz-entrada)" />
              <text
                x={e.rect.x + e.rect.w / 2}
                y={e.rect.y + e.rect.h / 2 + 4}
                textAnchor="middle"
                className="fill-white text-[10px] font-semibold"
                transform={e.rect.h > e.rect.w ? `rotate(-90 ${e.rect.x + e.rect.w / 2} ${e.rect.y + e.rect.h / 2})` : undefined}
              >
                {e.nome.replace('Entrada ', '').replace(/ \(.*\)/, '')}
              </text>
            </g>
        ))}


        <defs>
          {/* Ponta de tamanho fixo (não cresce com a espessura da linha) */}
          <marker id="ponta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="var(--viz-seta)" />
          </marker>
          <marker id="ponta-saida" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#2563eb" />
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
          const larg = 2 + (s.valor / maxSeta) * 5;
          const curta = len < 120; // setas das portas: começam/terminam perto
          const ax = x1 + ox + (dx / len) * (curta ? 0 : 22);
          const ay = y1 + oy + (dy / len) * (curta ? 0 : 22);
          const bx = x2 + ox - (dx / len) * (curta ? 4 : 26);
          const by = y2 + oy - (dy / len) * (curta ? 4 : 26);
          const azul = s.cor === 'saida';
          return (
            <g
              key={i}
              onMouseMove={(e) => {
                const svg = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
                setHover({ x: e.clientX - svg.left, y: e.clientY - svg.top, texto: [s.rotulo ?? 'Fluxo', `${s.valor.toLocaleString('pt-BR')} pessoas no dia (estimativa)`] });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#fff" strokeOpacity="0.9" strokeWidth={larg + 3} strokeLinecap="round" />
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={azul ? '#2563eb' : 'var(--viz-seta)'} strokeWidth={larg} strokeLinecap="round" markerEnd={azul ? 'url(#ponta-saida)' : 'url(#ponta)'} />
              {s.etiqueta && (
                <g transform={`translate(${ax - ox * 0.2}, ${ay - oy * 0.2})`}>
                  <rect x={-s.etiqueta.length * 3.4 - 5} y="-8" width={s.etiqueta.length * 6.8 + 10} height="16" rx="8" fill={azul ? '#2563eb' : 'var(--viz-seta)'} />
                  <text textAnchor="middle" y="4" className="fill-white text-[10px] font-semibold">
                    {s.etiqueta}
                  </text>
                </g>
              )}
            </g>
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
      {trocarVisao && <SeletorVisao andar={andar} estilo={estilo} mudar={setEstilo} />}
    </div>
  );
}

// ---------- visões do mapa (como as camadas do Google Maps) ----------

const VISOES: { id: EstiloMapa; nome: string; dica: string }[] = [
  { id: 'mapa', nome: 'Mapa', dica: 'Desenho limpo: corredores, lojas e estacionamento' },
  { id: 'planta', nome: 'Planta', dica: 'Planta oficial do shopping, com o nome das lojas' },
];

function Miniatura({ andar, estilo }: { andar: Andar; estilo: EstiloMapa }) {
  const f = FUNDO[andar];
  const e = ESBOCO[andar];
  return (
    <svg viewBox="0 0 1000 560" className="block h-full w-full" aria-hidden>
      <rect width="1000" height="560" fill="var(--viz-fundo)" />
      {estilo !== 'mapa' && <image href={f.src} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="none" />}
      {estilo === 'mapa' && (
        <>
          {e.contorno.map((p, i) => <path key={`c${i}`} d={caminho(p)} fill="var(--viz-loja)" fillRule="evenodd" />)}
          {e.lojas.map((p, i) => <path key={`l${i}`} d={caminho(p)} fill="var(--viz-neutro)" />)}
          {e.corredores.map((p, i) => <path key={`r${i}`} d={caminho(p)} fill="var(--viz-fundo)" fillRule="evenodd" />)}
        </>
      )}
    </svg>
  );
}

/** Botão no canto do mapa: mostra a visão atual e abre as 3 opções com miniatura. */
export function SeletorVisao({ andar, estilo, mudar }: { andar: Andar; estilo: EstiloMapa; mudar: (e: EstiloMapa) => void }) {
  const [aberto, setAberto] = useState(false);
  const atual = VISOES.find((v) => v.id === estilo)!;
  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-end gap-2">
      <button onClick={() => setAberto(!aberto)} title="Trocar a visão do mapa" aria-expanded={aberto} className="group relative h-16 w-20 overflow-hidden rounded-md bg-surface shadow-md ring-2 ring-surface transition-shadow hover:ring-primary">
        <Miniatura andar={andar} estilo={estilo} />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent pb-1 pt-3 text-[11px] font-semibold text-white">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M8 2 1.5 5.5 8 9l6.5-3.5zM1.5 8.5 8 12l6.5-3.5" strokeLinejoin="round" />
          </svg>
          {atual.nome}
        </span>
      </button>
      {aberto && (
        <div className="flex gap-2 rounded-lg bg-surface p-2 shadow-lg ring-1 ring-outline-variant">
          {VISOES.map((v) => (
            <button key={v.id} onClick={() => { mudar(v.id); setAberto(false); }} title={v.dica} className="flex w-20 flex-col items-center gap-1 text-[11px] font-medium">
              <span className={`block h-12 w-full overflow-hidden rounded ring-2 transition-shadow ${estilo === v.id ? 'ring-primary' : 'ring-transparent hover:ring-outline-variant'}`}>
                <Miniatura andar={andar} estilo={v.id} />
              </span>
              <span className={estilo === v.id ? 'text-primary' : 'text-on-surface-variant'}>{v.nome}</span>
            </button>
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
