'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { IconeBusca } from '@/components/ui/icones';
import type { PontoDispositivo } from '@/components/mapas/MapaDispositivos';

const MapaDispositivos = dynamic(() => import('@/components/mapas/MapaDispositivos').then((m) => m.MapaDispositivos), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">Carregando mapa…</div>,
});

export function DispositivosMapaClient({ pontos }: { pontos: PontoDispositivo[] }) {
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pontos;
    return pontos.filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.colaboradorNome?.toLowerCase().includes(termo) || p.cidade?.toLowerCase().includes(termo)
    );
  }, [pontos, busca]);

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <IconeBusca className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por funcionário, unidade ou cidade…"
          className="w-full rounded-sm border border-outline-variant bg-surface py-2 pl-9 pr-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      </div>
      <div className="h-[520px] overflow-hidden rounded border border-outline-variant">
        <MapaDispositivos pontos={filtrados} />
      </div>
    </div>
  );
}
