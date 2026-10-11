import { exigirSessao } from '@/lib/sessaoServidor';
import { listarUnidades } from '@/lib/cadastros';
import { CadastrosTabs } from '@/components/admin/CadastrosTabs';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { criarUnidadeAction } from '../actions';

export default async function UnidadesPage() {
  const sessao = await exigirSessao();
  const unidades = await listarUnidades(sessao.empresaId);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-on-surface">Cadastros</h1>
      <p className="mb-4 text-sm text-on-surface-variant">Estrutura da empresa: unidades, departamentos, colaboradores e dispositivos.</p>
      <CadastrosTabs />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">UF</th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-on-surface">{u.nome}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{u.cidade ?? '—'}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{u.estado ?? '—'}</td>
                  </tr>
                ))}
                {unidades.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-on-surface-variant">
                      Nenhuma unidade cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-on-surface">Nova unidade</h2>
          <form action={criarUnidadeAction} className="flex flex-col gap-4">
            <Field label="Nome" name="nome" required />
            <Field label="Cidade" name="cidade" />
            <Field label="UF" name="estado" maxLength={2} placeholder="PE" />
            <Button type="submit">Criar unidade</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
