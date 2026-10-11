"use client";

// Cabeçalho da LP: no topo o fundo/borda ficam transparentes (o vídeo
// do hero aparece por baixo, "clean"), e ao rolar um pouco eles
// "aparecem" com uma transição suave, voltando a sumir se a pessoa
// rolar de volta pro topo. Marca e ações (HeaderActions) continuam
// sempre visíveis, só o FUNDO da barra que pisca de transparente pra
// sólido.
//
// position: fixed (não sticky) de propósito: sai do fluxo normal e não
// empurra o hero pra baixo enquanto está transparente.
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
          <Image src="/argus-logo.png" alt="Argus" width={751} height={187} priority className="h-6 w-auto" />
        </div>
        <HeaderActions />
      </div>
    </header>
  );
}
