"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

// Ícone de 3 traços sem fundo/borda, que vira um X, abrindo um painel
// em tela cheia (não um dropdown), com os links entrando em cascata.
// Painel renderizado via portal direto em document.body: o cabeçalho
// tem backdrop-blur, que vira "containing block" pra position:fixed e
// prendia o painel dentro da altura do cabeçalho. z-20, abaixo do z-30
// do cabeçalho, pra ele continuar visível por cima (só a marca e o "X").
const LINKS = [
  { label: "Início", href: "/" },
  { label: "Entrar", href: "/login" },
  { label: "Fale Conosco", href: "mailto:contato@logoscompany.io" },
];

export default function MobileMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-1.5 text-on-surface"
      >
        <span
          className={`h-0.5 w-6 bg-current transition-transform duration-300 ease-out ${
            open ? "translate-y-2 rotate-45" : ""
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-current transition-opacity duration-200 ease-out ${
            open ? "opacity-0" : ""
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-current transition-transform duration-300 ease-out ${
            open ? "-translate-y-2 -rotate-45" : ""
          }`}
        />
      </button>

      {mounted &&
        createPortal(
          <div
            aria-hidden={!open}
            className={`fixed inset-0 z-20 flex flex-col overflow-hidden bg-surface pt-24 transition-opacity duration-300 ease-out ${
              open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <ul className="flex flex-col gap-lg px-gutter">
              {LINKS.map((item, i) => (
                <li
                  key={item.href}
                  className={`transition-all duration-300 ease-out ${
                    open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                  }`}
                  style={{ transitionDelay: open ? `${i * 50}ms` : "0ms" }}
                >
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="argus-mono block text-title-lg text-on-surface/90 hover:text-tertiary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
