import { redirect } from 'next/navigation';
import { getSessaoAtual } from '@/lib/sessaoServidor';
import { FormTrocarSenha } from './FormTrocarSenha';

export default async function TrocarSenhaPage() {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect('/login');
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-dim px-4">
      <div className="w-full max-w-sm rounded border border-outline-variant bg-surface p-8">
        <h1 className="text-xl font-semibold text-on-surface">Crie uma senha nova</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {sessao.trocarSenha ? `Olá, ${sessao.nome}. Por segurança, troque a senha provisória antes de continuar.` : 'Troque a sua senha de acesso.'}
        </p>
        <FormTrocarSenha />
      </div>
    </div>
  );
}
