'use client';

import { Button } from '@/components/ui/Button';

/** Gera e baixa um CSV (separador ";" pro Excel em português abrir direto). */
export function BotaoCSV({ nomeArquivo, cabecalho, linhas }: { nomeArquivo: string; cabecalho: string[]; linhas: (string | number)[][] }) {
  function baixar() {
    const esc = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);
    const csv = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="outline" size="sm" onClick={baixar}>
      Exportar CSV
    </Button>
  );
}
