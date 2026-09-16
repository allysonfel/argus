import { exigirSessao } from '@/lib/sessaoServidor';
import { listarUnidades, listarDepartamentos } from '@/lib/cadastros';
import { Card } from '@/components/ui/Card';
import { Field, SelectField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { criarColaboradorAction } from '../../actions';
import Link from 'next/link';

export default async function NovoColaboradorPage() {
  const sessao = await exigirSessao();
  const [unidades, departamentos] = await Promise.all([listarUnidades(sessao.empresaId), listarDepartamentos(sessao.empresaId)]);

  return (
    <div className="max-w-2xl">
      <Link href="/cadastros/colaboradores" className="mb-4 inline-block text-sm text-on-surface-variant hover:text-on-surface">
        ‹ Voltar
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-on-surface">Novo colaborador</h1>

      <Card>
        <form action={criarColaboradorAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome completo" name="nome" required className="sm:col-span-2" />
          <Field label="Cargo" name="cargo" />
          <Field label="CPF" name="cpf" />
          <Field label="E-mail" name="email" type="email" />
          <Field label="Telefone" name="telefone" />
          <SelectField label="Unidade" name="unidadeId">
            <option value="">—</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </SelectField>
          <SelectField label="Departamento" name="departamentoId">
            <option value="">—</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </SelectField>
          <Field label="Data de admissão" name="dataAdmissao" type="date" />
          <Field label="Jornada semanal (horas)" name="jornadaSemanalHoras" type="number" defaultValue={44} />
          <Field label="Entrada padrão" name="horarioEntradaPadrao" type="time" defaultValue="07:30" />
          <Field label="Saída padrão" name="horarioSaidaPadrao" type="time" defaultValue="17:00" />
          <div className="sm:col-span-2">
            <Button type="submit">Cadastrar colaborador</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
