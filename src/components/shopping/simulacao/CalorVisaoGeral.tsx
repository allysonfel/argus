'use client';

import { useEffect, useMemo, useState } from 'react';
import { agoraDemo } from '@/lib/shopping/demo';
import type { Andar } from '@/lib/shopping/planta';
import { MIN_DIA, sementeDoDia, simular } from '@/lib/shopping/simulacao';
import { MapaSimulacao, SeletorAndar, useRelogio } from './MapaSimulacao';

/** Mapa de calor da Visão geral: o mesmo da tela Mapa de calor, sem os controles.
 * Hoje = ao vivo; outro dia = o dia inteiro acumulado. */
export function CalorVisaoGeral({ dia }: { dia: string }) {
  const relogio = useRelogio();
  const [andar, setAndar] = useState<Andar>('T');
  const hoje = dia >= agoraDemo().data;
  useEffect(() => {
    if (hoje) return;
    relogio.setDia(dia);
    relogio.irPara(MIN_DIA - 0.01);
    relogio.setTocando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, hoje]);
  const diaSim = hoje ? relogio.dia : dia;
  const sim = useMemo(() => simular([], sementeDoDia(diaSim), diaSim), [diaSim]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <SeletorAndar andar={andar} setAndar={setAndar} />
      </div>
      <MapaSimulacao sim={sim} andar={andar} relogio={relogio} calor="dia" estiloInicial="mapa" />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        <span>Pouco</span>
        <span className="h-2.5 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #10b981, #facc15, #dc2626)' }} />
        <span>Muito movimento</span>
      </div>
    </div>
  );
}
