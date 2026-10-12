'use client';

import { useEffect, useState } from 'react';
import { carregarCaso, type Caso } from '@/lib/shopping/casos';

export function useCaso(urlMotor: string, camera: string) {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setCaso(null);
    setErro(null);
    carregarCaso(urlMotor, camera)
      .then((c) => vivo && setCaso(c))
      .catch((e) => vivo && setErro(String(e.message ?? e)));
    return () => {
      vivo = false;
    };
  }, [urlMotor, camera]);
  return { caso, erro };
}

export function ErroCaso({ erro, urlMotor }: { erro: string; urlMotor: string }) {
  return (
    <div className="rounded-sm border border-error/40 bg-error-container/40 p-4 text-sm text-on-surface">
      <p className="font-semibold">Não consegui carregar o caso real.</p>
      <p className="mt-1 text-on-surface-variant">
        O caso vem do motor de visão ({urlMotor}). Confira se ele está no ar e se os casos foram gerados (<code>uv run --group casos gerar_casos.py</code>). Detalhe: {erro}
      </p>
    </div>
  );
}
