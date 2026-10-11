import { useSyncExternalStore } from "react";

// Relógio compartilhado (um único setInterval pra todos os quadros de
// câmera da página). useSyncExternalStore em vez de useState+useEffect:
// no servidor devolve 0 (placeholder "--"), então o HTML do servidor e
// o primeiro render do cliente são idênticos e não dá erro de
// hidratação; depois de montar, passa a mostrar a hora de verdade.
const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = Math.floor(Date.now() / 1000);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Math.floor(Date.now() / 1000);
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useClock(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0
  );
}

const STAMP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const CLOCK = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatStamp(seconds: number): string {
  return seconds === 0 ? "--/--/---- --:--:--" : STAMP.format(new Date(seconds * 1000)).replace(",", "");
}

export function formatClock(seconds: number): string {
  return seconds === 0 ? "--:--" : CLOCK.format(new Date(seconds * 1000));
}
