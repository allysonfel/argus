'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';

// Filtro de período da Visão geral (simulação): atalhos + intervalo de datas.
export const ATALHOS = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'ontem', nome: 'Ontem' },
  { id: '7', nome: 'Últimos 7 dias' },
  { id: '30', nome: 'Últimos 30 dias' },
];

export function FiltroPeriodo({ atual, de, ate, hoje, minimo }: { atual: string; de: string; ate: string; hoje: string; minimo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [abrirDatas, setAbrirDatas] = useState(atual === 'personalizado');
  const [ini, setIni] = useState(de);
  const [fim, setFim] = useState(ate);
  const ir = (q: string) => router.push(`${pathname}?${q}`, { scroll: false });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-md bg-surface-container p-1">
        {ATALHOS.map((a) => (
          <button key={a.id} onClick={() => { setAbrirDatas(false); ir(`periodo=${a.id}`); }} className={cn('h-8 rounded px-3 text-sm font-medium transition-colors', atual === a.id ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}>
            {a.nome}
          </button>
        ))}
        <button onClick={() => setAbrirDatas(true)} className={cn('h-8 rounded px-3 text-sm font-medium transition-colors', atual === 'personalizado' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}>
          Escolher datas
        </button>
      </div>
      {abrirDatas && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-outline-variant bg-surface px-2 py-1">
          <input type="date" value={ini} min={minimo} max={hoje} onChange={(e) => setIni(e.target.value)} className="h-8 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface" aria-label="De" />
          <span className="text-xs text-on-surface-variant">até</span>
          <input type="date" value={fim} min={minimo} max={hoje} onChange={(e) => setFim(e.target.value)} className="h-8 rounded-sm border border-outline-variant bg-surface px-2 text-xs text-on-surface" aria-label="Até" />
          <button disabled={!ini || !fim || ini > fim} onClick={() => ir(`periodo=personalizado&de=${ini}&ate=${fim}`)} className="h-8 rounded-sm bg-primary px-3 text-xs font-semibold text-on-primary disabled:opacity-50">
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
