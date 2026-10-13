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

/** Mostra a tela do modo escolhido no botão global (canto superior direito). */
export function AlternarSimulacao({ real, simulado }: { real: ReactNode; simulado: ReactNode }) {
  const [ligada] = useSimulacaoShopping();
  return <>{ligada ? simulado : real}</>;
}

/** Botão global, fixo no canto superior direito de todas as telas do shopping. */
export function BotaoSimulacao() {
  const [ligada, setLigada] = useSimulacaoShopping();
  return (
    <div className="fixed right-4 top-3 z-40 print:hidden max-lg:top-16">
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        onClick={() => setLigada(!ligada)}
        title={ligada ? 'Simulação do shopping inteiro ligada (apresentação). Clique para voltar às câmeras reais.' : 'Mostrando as 15 câmeras reais. Clique para ligar a simulação do shopping inteiro.'}
        className={`flex items-center gap-2.5 rounded-full border py-1.5 pl-3 pr-1.5 text-xs font-semibold shadow-md backdrop-blur transition-colors ${ligada ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-surface/95 text-on-surface'}`}
      >
        <span className="flex flex-col items-start leading-tight">
          <span>{ligada ? 'Simulação do shopping' : 'Câmeras reais'}</span>
          <span className={`text-[10px] font-normal ${ligada ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{ligada ? 'shopping inteiro simulado' : '15 câmeras de demonstração'}</span>
        </span>
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ligada ? 'bg-white/30' : 'bg-outline-variant'}`}>
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${ligada ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </button>
    </div>
  );
}
