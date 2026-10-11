'use client';

import dynamic from 'next/dynamic';
import type { PontoMarcacao } from '@/components/mapas/MapaPonto';

const MapaPonto = dynamic(() => import('@/components/mapas/MapaPonto').then((m) => m.MapaPonto), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">Carregando mapa…</div>,
});

export function PontoMapaClient({ pontos }: { pontos: PontoMarcacao[] }) {
  return (
    <div className="h-[520px] overflow-hidden rounded border border-outline-variant">
      <MapaPonto pontos={pontos} />
    </div>
  );
}
