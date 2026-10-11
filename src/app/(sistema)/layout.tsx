import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Argus | Logos Company',
  description: 'Gestão de operação — ponto eletrônico com IA, rastreio de dispositivos, uso digital e alertas.',
};

// Roda antes da primeira pintura pra aplicar o tema salvo sem "piscar"
// claro antes de trocar pro escuro — claro é o padrão, só adiciona a
// classe "dark" se a pessoa já escolheu "Escuro" antes (ver ThemeToggle.tsx).
const SCRIPT_TEMA = `try{if(localStorage.getItem('argus-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
