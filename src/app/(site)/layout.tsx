import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./site-theme.css";

const inter = Inter({ subsets: ["latin"], weight: "400", variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: "400", variable: "--font-jetbrains-mono" });

// "/" é a LP institucional do Argus, com identidade visual própria
// (tema "Oxide", ver site-theme.css), isolada do sistema em /painel:
// por isso tem <html> própria aqui, sem compartilhar layout com o
// resto do app (ver Next.js "multiple root layouts").
export const metadata: Metadata = {
  title: "Argus | Logos Company",
  description:
    "Ponto com IA, dispositivos no mapa, câmeras com IA e alertas em tempo real, numa única plataforma.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-surface text-on-surface">{children}</body>
    </html>
  );
}
