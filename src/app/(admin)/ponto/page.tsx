import Link from 'next/link';
import { exigirSessao } from '@/lib/sessaoServidor';
import { listarColaboradores } from '@/lib/cadastros';
import { contarAjustesPendentes } from '@/lib/ajustes';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconeSeta } from '@/components/ui/icones';

const STATUS_LABEL: Record<string, { texto: string; variante: 'success' | 'secondary' | 'warning' | 'neutral' }> = {
  ativo: { texto: 'Ativo', variante: 'success' },
  ferias: { texto: 'Férias', variante: 'secondary' },
  afastado: { texto: 'Afastado', variante: 'warning' },
  desligado: { texto: 'Desligado', variante: 'neutral' },
};

export default async function PontoPage() {
  const sessao = await exigirSessao();
  const [colaboradores, ajustesPendentes] = await Promise.all([listarColaboradores(sessao.empresaId), contarAjustesPendentes(sessao.empresaId)]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-on-surface">Ponto &amp; Banco de Horas</h1>
        <Link href="/ponto/pendencias" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Pendências {ajustesPendentes > 0 && <Badge variant="warning">{ajustesPendentes}</Badge>}
          <IconeSeta width={14} height={14} />
        </Link>
      </div>
      <p className="mb-6 text-sm text-on-surface-variant">Escolha um colaborador pra ver o cartão-ponto e o banco de horas do período.</p>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((c) => (
                <tr key={c.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low">
                  <td className="px-4 py-3">
                    <Link href={`/ponto/${c.id}`} className="font-medium text-on-surface hover:text-primary">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.cargo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_LABEL[c.status].variante}>{STATUS_LABEL[c.status].texto}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/ponto/${c.id}`}>
                      <IconeSeta className="text-on-surface-variant" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
