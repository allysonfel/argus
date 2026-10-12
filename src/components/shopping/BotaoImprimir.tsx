'use client';

import { Button } from '@/components/ui/Button';

/** Relatório em PDF pela impressão do navegador ("Salvar como PDF"). */
export function BotaoImprimir({ rotulo }: { rotulo: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
      {rotulo}
    </Button>
  );
}
