"use client";

// Guarda o estado (open) aqui em vez de dentro do MobileMenu, pra que o
// "Entrar" também suma quando o menu abre, ficando só a marca visível
// por cima do painel em tela cheia.
import { useState } from "react";
import Link from "next/link";
import MobileMenu from "./MobileMenu";

export default function HeaderActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-sm">
      {/* Escondido abaixo de sm: (640px) — logo + botão + hambúrguer não
          cabem juntos em telas de celular mais estreitas. Continua
          acessível pelo "Entrar" no menu. */}
      {!open && (
        <Link
          href="/login"
          className="argus-mono hidden h-9 items-center justify-center whitespace-nowrap border border-outline-variant px-4 text-label-sm text-on-surface transition-colors hover:border-on-surface hover:text-on-surface sm:inline-flex"
        >
          Entrar
        </Link>
      )}
      <MobileMenu open={open} onOpenChange={setOpen} />
    </div>
  );
}
