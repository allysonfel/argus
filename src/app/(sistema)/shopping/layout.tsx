import type { Metadata } from 'next';
import { exigirSessao } from '@/lib/sessaoServidor';
import { SidebarShopping, MenuMovelShopping } from '@/components/shopping/SidebarShopping';
import { PergunteArgus } from '@/components/shopping/PergunteArgus';

export const metadata: Metadata = {
  title: 'Argus | Shopping Caruaru',
  description: 'Inteligência das câmeras de corredor do Shopping Caruaru: fluxo, mapa de calor, rotas, segurança e portal do lojista.',
};

// Painel EXCLUSIVO do Shopping Caruaru: menu, nome e telas próprios,
// separado do painel de ponto (/painel).
export default async function ShoppingLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();

  return (
    <div className="min-h-screen bg-surface-dim">
      <SidebarShopping nomeUsuario={sessao.nome} />
      <MenuMovelShopping nomeUsuario={sessao.nome} />
      <main className="pb-24 lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">{children}</div>
      </main>
      <PergunteArgus />
    </div>
  );
}
