import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Argus | Logos Company',
  description: 'Gestão de operação — ponto eletrônico com IA, rastreio de dispositivos, uso digital e alertas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
