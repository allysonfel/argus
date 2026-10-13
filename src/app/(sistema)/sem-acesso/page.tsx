import { fazerLogout } from '../login/actions';

export default function SemAcessoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dim px-4">
      <div className="w-full max-w-sm rounded border border-outline-variant bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-on-surface">Sem acesso liberado</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Seu usuário ainda não tem nenhuma aba liberada. Peça ao administrador do sistema para ajustar as suas permissões.</p>
        <form action={fazerLogout} className="mt-6">
          <button type="submit" className="text-sm font-medium text-primary hover:underline">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
