'use client';

import { useRef, useState } from 'react';
import { Planta } from './Planta';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { AREAS_RESTRITAS, centro } from '@/lib/shopping/planta';
import { ROTULO_STATUS, type Alerta, type StatusAlerta } from '@/lib/shopping/seguranca';

const VARIANTE: Record<StatusAlerta, 'error' | 'warning' | 'success' | 'neutral'> = { novo: 'error', atendimento: 'warning', resolvido: 'success', falso: 'neutral' };

function bipe() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    // navegador sem áudio: o destaque visual continua
  }
}

/** Quadro simulado da câmera (a evidência real é foto + clipe do NVR). */
function QuadroEvidencia({ alerta }: { alerta: Alerta }) {
  const pessoa = alerta.tipo === 'Pessoa em área restrita';
  const escura = alerta.tipo === 'Câmera tapada ou escura';
  return (
    <svg viewBox="0 0 320 180" className="block w-full rounded-sm bg-black">
      <defs>
        <linearGradient id="chao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#141414" />
        </linearGradient>
      </defs>
      {!escura && (
        <g opacity={alerta.tipo === 'Câmera desviada' ? 0.6 : 1} transform={alerta.tipo === 'Câmera desviada' ? 'rotate(14 160 90)' : undefined}>
          <rect width="320" height="180" fill="url(#chao)" />
          <path d="M0 120 L120 70 L200 70 L320 120 L320 180 L0 180Z" fill="#2a2a2a" />
          <rect x="130" y="30" width="60" height="40" fill="#1d1d1d" stroke="#555" />
          {pessoa && (
            <g>
              <circle cx="205" cy="92" r="7" fill="#9a9a9a" />
              <rect x="198" y="100" width="14" height="30" rx="4" fill="#7d7d7d" />
              <rect x="190" y="80" width="32" height="56" fill="none" stroke="#ff4d4d" strokeWidth="2" />
              <text x="190" y="76" fill="#ff4d4d" fontSize="9" fontFamily="monospace">
                pessoa {alerta.confiancaPct}%
              </text>
            </g>
          )}
        </g>
      )}
      <text x="8" y="14" fill="#e5e5e5" fontSize="9" fontFamily="monospace">
        {alerta.cameraId} · {alerta.quando}
      </text>
      {escura && (
        <text x="160" y="95" textAnchor="middle" fill="#888" fontSize="11" fontFamily="monospace">
          imagem escura / obstruída
        </text>
      )}
    </svg>
  );
}

export function CentralAlertas({ iniciais, nomes }: { iniciais: Alerta[]; nomes: Record<string, string> }) {
  const [alertas, setAlertas] = useState(iniciais);
  const [selId, setSelId] = useState(iniciais[0]?.id);
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos');
  const contador = useRef(1043);
  const sel = alertas.find((a) => a.id === selId);
  const area = AREAS_RESTRITAS.find((a) => a.id === sel?.areaId);
  const lista = alertas.filter((a) => filtro === 'todos' || a.status === 'novo' || a.status === 'atendimento');

  function atualizar(id: string, dados: Partial<Alerta>) {
    setAlertas((as) => as.map((a) => (a.id === id ? { ...a, ...dados } : a)));
  }

  function simular() {
    const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const novo: Alerta = {
      id: `AL-${contador.current++}`,
      areaId: 'ar-tesouraria',
      cameraId: 'CAM-T-22',
      tipo: 'Pessoa em área restrita',
      prioridade: 'alta',
      quando: `${agora.slice(0, 10)} ${agora.slice(11, 16)}`,
      confiancaPct: 89,
      permanenciaS: 14,
      status: 'novo',
    };
    setAlertas((as) => [novo, ...as]);
    setSelId(novo.id);
    setFiltro('abertos');
    bipe();
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <div className="min-w-0 xl:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['abertos', 'todos'] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={cn('rounded-sm px-3 py-1.5 text-xs font-medium', filtro === f ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low')}>
                {f === 'abertos' ? `Abertos (${alertas.filter((a) => a.status === 'novo' || a.status === 'atendimento').length})` : `Todos (${alertas.length})`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={simular}>
            Simular alerta (com som)
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {lista.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelId(a.id)}
                className={cn(
                  'w-full rounded-sm border px-3 py-2.5 text-left transition-colors',
                  a.id === selId ? 'border-primary bg-surface-container-low' : 'border-outline-variant hover:bg-surface-container-low',
                  a.status === 'novo' && 'border-l-4 border-l-error'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-on-surface">{a.tipo}</span>
                  <Badge variant={VARIANTE[a.status]}>{ROTULO_STATUS[a.status]}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {nomes[a.areaId]} · {a.quando.split(' ')[0].split('-').reverse().join('/')} {a.quando.split(' ')[1]} · {a.id}
                </p>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="text-sm text-on-surface-variant">Nenhum alerta aberto.</li>}
        </ul>
      </div>

      {sel && area ? (
        <div className="min-w-0 xl:col-span-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Imagem do momento</p>
              <QuadroEvidencia alerta={sel} />
              <p className="mt-1 text-[11px] text-on-surface-variant">Foto + clipe de {10} s antes e depois · guardados por 30 dias · visíveis só para Segurança e Administração</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Onde</p>
              <Planta andar={area.andar} mostrarRestritas marcadores={[{ x: centro(area.rect)[0], y: centro(area.rect)[1], rotulo: area.nome, tom: 'alerta' }]} />
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-on-surface-variant">Câmera</dt>
              <dd className="text-on-surface">{sel.cameraId}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Prioridade</dt>
              <dd className="text-on-surface">{sel.prioridade === 'alta' ? 'Alta' : 'Média'}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Confiança</dt>
              <dd className="text-on-surface">{sel.confiancaPct}%</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Permanência</dt>
              <dd className="text-on-surface">{sel.permanenciaS ? `${sel.permanenciaS} s` : 'não se aplica'}</dd>
            </div>
          </dl>

          <form
            key={sel.id}
            className="mt-4 grid grid-cols-1 gap-3 rounded-sm border border-outline-variant p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const status = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as StatusAlerta;
              atualizar(sel.id, { status, responsavel: String(f.get('responsavel') || '') || undefined, observacao: String(f.get('observacao') || '') || undefined });
            }}
          >
            <Field label="Responsável" name="responsavel" defaultValue={sel.responsavel} placeholder="Quem está atendendo" />
            <Field label="Observação" name="observacao" defaultValue={sel.observacao} placeholder="O que foi verificado" />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {sel.status === 'novo' && (
                <Button type="submit" name="status" value="atendimento" size="sm">
                  Assumir atendimento
                </Button>
              )}
              {(sel.status === 'novo' || sel.status === 'atendimento') && (
                <>
                  <Button type="submit" name="status" value="resolvido" size="sm" variant="outline">
                    Marcar como resolvido
                  </Button>
                  <Button type="submit" name="status" value="falso" size="sm" variant="ghost">
                    Falso alarme
                  </Button>
                </>
              )}
              {(sel.status === 'resolvido' || sel.status === 'falso') && (
                <Button type="submit" name="status" value={sel.status} size="sm" variant="outline">
                  Salvar observação
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant xl:col-span-3">Selecione um alerta.</p>
      )}
    </div>
  );
}
