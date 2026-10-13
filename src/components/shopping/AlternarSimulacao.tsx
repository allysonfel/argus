'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Liga/desliga a SIMULAÇÃO DO SHOPPING (apresentação): desligada, as telas
// mostram o que o motor viu nas câmeras de demonstração (real); ligada,
// mostram o shopping inteiro com visitantes simulados sobre a planta. A
// escolha vale para Mapa de calor, Zonas mortas e Rotas (fica no navegador).

const CHAVE = 'argus-simulacao-shopping';
const EVENTO = 'argus-simulacao-shopping';

export function useSimulacaoShopping(): [boolean, (v: boolean) => void] {
  const [ligada, setLigada] = useState(false);
  useEffect(() => {
    try {
      setLigada(localStorage.getItem(CHAVE) === '1');
    } catch {}
    const ouvir = (e: Event) => setLigada((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);
  const mudar = (v: boolean) => {
    setLigada(v);
    try {
      localStorage.setItem(CHAVE, v ? '1' : '0');
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: v }));
  };
  return [ligada, mudar];
}

/** Barra com o botão + a tela do modo escolhido. */
export function AlternarSimulacao({ real, simulado }: { real: ReactNode; simulado: ReactNode }) {
  const [ligada, setLigada] = useSimulacaoShopping();
  return (
    <div className="flex flex-col gap-6">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-sm border p-3 ${ligada ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface">{ligada ? 'Simulação do shopping (apresentação)' : 'Câmeras reais'}</p>
          <p className="text-xs text-on-surface-variant">
            {ligada
              ? 'O shopping inteiro sobre a planta, com visitantes simulados. Serve para mostrar como fica com todas as câmeras instaladas.'
              : 'Calculado a partir do que o motor de visão viu nos vídeos das câmeras de demonstração. Nada simulado.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ligada}
          onClick={() => setLigada(!ligada)}
          className="flex shrink-0 items-center gap-2 text-sm font-medium text-on-surface"
        >
          <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ligada ? 'bg-primary' : 'bg-outline-variant'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${ligada ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </span>
          Simulação do shopping
        </button>
      </div>
      {ligada ? simulado : real}
    </div>
  );
}
