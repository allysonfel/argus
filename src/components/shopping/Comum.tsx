import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export function SeloDemo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-outline px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant" title="Números gerados para demonstração. Serão substituídos pelos dados das câmeras.">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
      Dados de demonstração
    </span>
  );
}

export function TituloPagina({ titulo, descricao, demo = true, children }: { titulo: string; descricao?: string; demo?: boolean; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-on-surface">{titulo}</h1>
          {demo && <SeloDemo />}
        </div>
        {descricao && <p className="max-w-3xl text-sm text-on-surface-variant">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

export function Secao({ titulo, descricao, acao, children, className }: { titulo: string; descricao?: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('min-w-0', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-on-surface">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-xs text-on-surface-variant">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </Card>
  );
}

/** Variação percentual com seta e rótulo (nunca só cor). */
export function Variacao({ atual, anterior, sufixo = 'vs. período anterior' }: { atual: number; anterior: number; sufixo?: string }) {
  if (!anterior) return <span className="text-xs text-on-surface-variant">sem base de comparação</span>;
  const pct = ((atual - anterior) / anterior) * 100;
  const sobe = pct >= 0;
  return (
    <span className={cn('text-xs font-medium', sobe ? 'text-[var(--color-success)]' : 'text-error')}>
      {sobe ? '▲' : '▼'} {Math.abs(pct).toFixed(1).replace('.', ',')}% <span className="font-normal text-on-surface-variant">{sufixo}</span>
    </span>
  );
}

export function Tabela({ cabecalho, linhas, alinharDireita = [] }: { cabecalho: string[]; linhas: ReactNode[][]; alinharDireita?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
            {cabecalho.map((c, i) => (
              <th key={c} className={cn('px-2 py-2 font-semibold', alinharDireita.includes(i) && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-outline-variant/60 last:border-0">
              {l.map((c, j) => (
                <td key={j} className={cn('px-2 py-2 text-on-surface', alinharDireita.includes(j) && 'text-right tabular-nums')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
