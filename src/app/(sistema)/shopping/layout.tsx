import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { exigirSessao } from '@/lib/sessaoServidor';
import { SidebarShopping, MenuMovelShopping } from '@/components/shopping/SidebarShopping';
import { PergunteArgus } from '@/components/shopping/PergunteArgus';
import { BotaoSimulacao } from '@/components/shopping/AlternarSimulacao';
import { AberturaEntrada } from '@/components/shopping/AberturaEntrada';
import { obterConfiguracoes } from '@/lib/shopping/configuracoes';
import { podeVer } from '@/lib/shopping/permissoes';
import { perguntasHoje } from '@/lib/auditoria';
import './tema.css';

export const metadata: Metadata = {
  title: 'Argus | Shopping Caruaru',
  description: 'Inteligência das câmeras de corredor do Shopping Caruaru: fluxo, mapa de calor, rotas e segurança.',
};

// Fonte dos títulos e números de destaque (ver tema.css). O texto corrido
// continua na fonte do sistema, como no resto do Argus.
const fonteTitulo = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-titulo', display: 'swap' });

// Painel EXCLUSIVO do Shopping Caruaru: menu, nome e telas próprios,
// separado do painel de ponto (/painel).
export default async function ShoppingLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  const cfg = await obterConfiguracoes(sessao.empresaId);
  const menu = { nomeUsuario: sessao.nome, permissoes: { adminGeral: sessao.adminGeral, abas: sessao.abas }, nomeShopping: cfg.nome, logo: cfg.logo };

  return (
    <div className={`tema-shopping ${fonteTitulo.variable} min-h-screen bg-surface-dim`}>
      <SidebarShopping {...menu} />
      <MenuMovelShopping {...menu} />
      <BotaoSimulacao />
      <main className="pb-24 lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:py-8">{children}</div>
      </main>
      {(await cookies()).has('argus-abertura') && <AberturaEntrada nome={sessao.nome} />}
      {cfg.pergunte_ativo && podeVer(sessao, 'pergunte') && <PergunteArgus limiteDia={cfg.pergunte_limite_dia} usadasHoje={await perguntasHoje(sessao.id, cfg.fuso)} />}
    </div>
  );
}
