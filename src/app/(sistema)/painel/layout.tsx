import { redirect } from 'next/navigation';
import { exigirSessao } from '@/lib/sessaoServidor';
import { Sidebar } from '@/components/admin/Sidebar';
import { MobileNav } from '@/components/admin/MobileNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  // Usuários criados no módulo do shopping não veem o painel de ponto.
  if (sessao.role === 'SHOPPING') redirect('/shopping');

  return (
    <div className="min-h-screen bg-surface-dim">
      <Sidebar nomeUsuario={sessao.nome} nomeEmpresa={sessao.empresaNome} />
      <main className="pb-20 lg:pb-8 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
