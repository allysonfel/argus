"use client";

// Cabeçalho do /argus, separado do page.tsx (Server Component) só por
// causa do scroll listener abaixo: no topo da página o fundo/borda ficam
// transparentes (o vídeo do hero aparece por baixo, "clean"), e ao
// rolar um pouco eles "aparecem" com uma transição suave, voltando a
// sumir se a pessoa rolar de volta pro topo. Marca, texto e os ícones
// de ação (HeaderActions) continuam sempre visíveis, só o FUNDO da
// barra que pisca de transparente pra sólido.
//
// position: fixed (não mais sticky) de propósito: assim ele sai do
// fluxo normal e não empurra o hero pra baixo enquanto está
// transparente, sobrando mais altura de tela pro título/subtítulo/
// botão/quadrado, que puderam subir e se agrupar mais (ver page.tsx,
// hero com min-h-[100svh] no lugar de calc(100svh-64px) por causa
// dessa mudança).
import { useEffect, useState } from "react";
import Image from "next/image";
import HeaderActions from "./HeaderActions";

const SCROLL_THRESHOLD = 40;

export default function ArgusHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-all duration-300 ${
        scrolled
          ? "border-b border-outline-variant/60 bg-surface/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-sm px-gutter py-sm">
        <div className="flex shrink-0 items-center">
          {/* Wordmark oficial do Argus (public/argus-logo.png, aparado de
              public/argus-white.png, que é quadrado com margem vazia) —
              substitui o ícone da Logos + texto "Logos [Argus]". */}
          <Image src="/argus-logo.png" alt="Logos [Argus]" width={751} height={187} priority className="h-6 w-auto" />
        </div>
        <HeaderActions />
      </div>
    </header>
  );
}
