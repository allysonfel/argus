'use client';

import { useEffect, useState } from 'react';
import { IconeSol, IconeLua } from '@/components/ui/icones';

const CHAVE_STORAGE = 'argus-theme';

// Alternador claro/escuro — claro é o padrão (ver script bloqueante em
// layout.tsx, que só adiciona a classe "dark" se o localStorage disser
// explicitamente "dark"). Escolha salva localmente por navegador, não é
// preferência de conta no banco.
export function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains('dark'));
  }, []);

  function aplicarTema(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(CHAVE_STORAGE, dark ? 'dark' : 'light');
    } catch {
      // Sem localStorage (modo privado etc.) — a escolha só não persiste
      // entre sessões, sem quebrar o alternador nessa aba.
    }
    setEscuro(dark);
  }

  return (
    <div className="mb-3 flex gap-1.5">
      <button
        type="button"
        onClick={() => aplicarTema(false)}
        aria-label="Modo claro"
        aria-pressed={!escuro}
        className={`flex flex-1 items-center justify-center rounded-sm border px-2 py-1.5 transition-colors ${
          !escuro
            ? 'border-outline bg-surface-container-low text-on-surface'
            : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
        }`}
      >
        <IconeSol width={16} height={16} />
      </button>
      <button
        type="button"
        onClick={() => aplicarTema(true)}
        aria-label="Modo escuro"
        aria-pressed={escuro}
        className={`flex flex-1 items-center justify-center rounded-sm border px-2 py-1.5 transition-colors ${
          escuro
            ? 'border-outline bg-surface-container-low text-on-surface'
            : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
        }`}
      >
        <IconeLua width={16} height={16} />
      </button>
    </div>
  );
}
