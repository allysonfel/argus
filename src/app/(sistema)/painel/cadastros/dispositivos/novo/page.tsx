import Link from 'next/link';
import { exigirSessao } from '@/lib/sessaoServidor';
import { listarColaboradores, listarUnidades } from '@/lib/cadastros';
import { Card } from '@/components/ui/Card';
import { Field, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { criarDispositivoAction } from '../../actions';

export default async function NovoDispositivoPage() {
  const sessao = await exigirSessao();
  const [colaboradores, unidades] = await Promise.all([listarColaboradores(sessao.empresaId), listarUnidades(sessao.empresaId)]);

  return (
    <div className="max-w-2xl">
      <Link href="/painel/cadastros/dispositivos" className="mb-4 inline-block text-sm text-on-surface-variant hover:text-on-surface">
        ‹ Voltar
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-on-surface">Novo dispositivo</h1>

      <Card>
        <form action={criarDispositivoAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" name="nome" required placeholder="Ex: Notebook da Ana" />
          <SelectField label="Tipo" name="tipo" defaultValue="notebook">
            <option value="notebook">Notebook</option>
            <option value="celular">Celular</option>
          </SelectField>
          <Field label="Identificador (série/IMEI)" name="identificador" />
          <SelectField label="Colaborador" name="colaboradorId">
            <option value="">—</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </SelectField>
          <SelectField label="Unidade" name="unidadeId">
            <option value="">—</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <Button type="submit">Cadastrar dispositivo</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
