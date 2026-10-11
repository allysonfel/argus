import { exigirSessao } from '@/lib/sessaoServidor';
import { listarDepartamentos, listarUnidades } from '@/lib/cadastros';
import { CadastrosTabs } from '@/components/admin/CadastrosTabs';
import { Card } from '@/components/ui/Card';
import { Field, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { criarDepartamentoAction } from '../actions';

export default async function DepartamentosPage() {
  const sessao = await exigirSessao();
  const [departamentos, unidades] = await Promise.all([listarDepartamentos(sessao.empresaId), listarUnidades(sessao.empresaId)]);
  const nomeUnidade = new Map(unidades.map((u) => [u.id, u.nome]));

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
                  <th className="px-4 py-3 font-medium">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map((d) => (
                  <tr key={d.id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-on-surface">{d.nome}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{d.unidade_id ? nomeUnidade.get(d.unidade_id) : '—'}</td>
                  </tr>
                ))}
                {departamentos.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-on-surface-variant">
                      Nenhum departamento cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-on-surface">Novo departamento</h2>
          <form action={criarDepartamentoAction} className="flex flex-col gap-4">
            <Field label="Nome" name="nome" required />
            <SelectField label="Unidade" name="unidadeId">
              <option value="">—</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </SelectField>
            <Button type="submit">Criar departamento</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
