import Link from 'next/link';
import { exigirSessao } from '@/lib/sessaoServidor';
import { listarColaboradores } from '@/lib/cadastros';
import { CadastrosTabs } from '@/components/admin/CadastrosTabs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { atualizarStatusColaboradorAction } from '../actions';
import type { StatusColaborador } from '@/lib/tipos';

const STATUS_LABEL: Record<StatusColaborador, { texto: string; variante: 'success' | 'secondary' | 'warning' | 'neutral' }> = {
  ativo: { texto: 'Ativo', variante: 'success' },
  ferias: { texto: 'Férias', variante: 'secondary' },
  afastado: { texto: 'Afastado', variante: 'warning' },
  desligado: { texto: 'Desligado', variante: 'neutral' },
};

export default async function ColaboradoresPage() {
  const sessao = await exigirSessao();
  const colaboradores = await listarColaboradores(sessao.empresaId);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Cadastros</h1>
      <p className="mb-4 text-sm text-on-surface-variant">Estrutura da empresa: unidades, departamentos, colaboradores e dispositivos.</p>
      <CadastrosTabs />

      <div className="mb-4 flex justify-end">
        <Link href="/cadastros/colaboradores/novo">
          <Button>+ Novo colaborador</Button>
        </Link>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Alterar status</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((c) => (
                <tr key={c.id} className="border-b border-outline-variant/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-on-surface">{c.nome}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{c.cpf ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_LABEL[c.status].variante}>{STATUS_LABEL[c.status].texto}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <form action={atualizarStatusColaboradorAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <select
                        name="status"
                        defaultValue={c.status}
                        className="rounded-sm border border-outline-variant bg-surface px-2 py-1 text-xs text-on-surface"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="ferias">Férias</option>
                        <option value="afastado">Afastado</option>
                        <option value="desligado">Desligado</option>
                      </select>
                      <Button size="sm" variant="outline" type="submit">
                        Salvar
                      </Button>
                    </form>
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
