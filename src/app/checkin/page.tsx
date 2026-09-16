import { exigirSessao } from '@/lib/sessaoServidor';
import { listarColaboradores } from '@/lib/cadastros';
import { CheckinForm } from './CheckinForm';

export default async function CheckinPage() {
  const sessao = await exigirSessao();
  const colaboradores = sessao.role === 'ADMIN' ? await listarColaboradores(sessao.empresaId, { status: 'ativo' }) : [];

  return (
    <div className="flex min-h-screen flex-col bg-surface-dim px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Argus</p>
          <h1 className="mt-1 text-xl font-semibold text-on-surface">Registrar ponto</h1>
        </div>
        <CheckinForm
          colaboradorIdSessao={sessao.colaboradorId}
          ehAdmin={sessao.role === 'ADMIN'}
          colaboradores={colaboradores.map((c) => ({ id: c.id, nome: c.nome }))}
        />
      </div>
    </div>
  );
}
