"use client";

// Guarda o estado (open) aqui em vez de dentro do MobileMenu, pelo mesmo
// motivo do Header.tsx do site: pra que o "Fale Conosco Agora" também
// suma quando o menu abre, ficando só a marca visível por cima do
// painel em tela cheia, igual no menu padrão.
import { useState } from "react";
import Link from "next/link";
import MobileMenu from "./MobileMenu";

export default function HeaderActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-sm">
      {/*
        Escondido abaixo de sm: (640px) — logo + botão + hambúrguer não
        cabem juntos em telas de celular mais estreitas (ex.: 390px) e o
        hambúrguer ficava cortado na borda. Continua acessível pelo
        "Contate-nos" no menu.
      */}
      {!open && (
        <Link
          href="/contato"
          className="argus-mono hidden h-9 items-center justify-center whitespace-nowrap border border-outline-variant px-4 text-label-sm text-on-surface transition-colors hover:border-on-surface hover:text-on-surface sm:inline-flex"
        >
          Fale Conosco Agora
        </Link>
      )}
      <MobileMenu open={open} onOpenChange={setOpen} />
    </div>
  );
}
