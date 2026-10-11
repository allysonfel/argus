"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import CameraTile from "./CameraTile";
import { EVENTS, ZONES, SEVERITIES, SCENARIOS } from "./cameraData";

// Cartão de demonstração "ao vivo" dentro do hero: uma janela com abas
// clicáveis do lado esquerdo, cada uma trocando o conteúdo do lado
// direito na hora (sem navegar pra outra página). 5 pilares (Ponto IA,
// Dispositivos no mapa, Câmeras IA, Alertas, Uso Digital).
type Tab = "ponto" | "dispositivos" | "cameras" | "alertas" | "uso";

const TABS: { id: Tab; label: string }[] = [
  { id: "ponto", label: "Ponto IA" },
  { id: "dispositivos", label: "Rastreio em Tempo Real" },
  { id: "cameras", label: "Câmeras IA" },
  { id: "alertas", label: "Alertas" },
  { id: "uso", label: "Uso Digital" },
];

// Ordem do ciclo automático e quanto tempo cada aba fica em tela antes
// de passar pra próxima sozinha. Clicar numa aba manualmente reinicia
// a contagem a partir dela.
const AUTO_ADVANCE_MS: Record<Tab, number> = {
  ponto: 7000,
  dispositivos: 7000,
  cameras: 7000,
  alertas: 7000,
  uso: 7000,
};

const CHECKS = [
  { label: "Rosto", img: "/ROSTO.png" },
  { label: "Capacete", img: "/capacete.png" },
  { label: "Uniforme", img: "/uniforme.png" },
];

const DEVICES_SAMPLE = [
  { device: "Notebook", name: "Ana", city: "São Paulo, SP" },
  { device: "Celular", name: "Carlos", city: "Campinas, SP" },
  { device: "Celular", name: "Felipe", city: "Recife, PE" },
  { device: "Notebook", name: "Gabriel", city: "Manaus, AM" },
];

const ALERTS_SAMPLE = [
  { color: "bg-error", ring: "bg-error/60", who: "Amanda", text: "atrasou 42 minutos" },
  {
    color: "bg-tertiary",
    ring: "bg-tertiary/60",
    who: "Amanda",
    text: "diminuiu a produtividade em 17% essa semana",
  },
];

const USAGE_SAMPLE = [
  { site: "sistemainterno.app", count: 1156, pct: 100 },
  { site: "web.whatsapp.com", count: 843, pct: 73 },
  { site: "gmail.com", count: 695, pct: 60 },
  { site: "youtube.com", count: 312, pct: 27 },
  { site: "instagram.com", count: 178, pct: 15 },
];

// Vídeo real no lugar do mock, em cada aba. Caixa sempre 16:9
// (aspect-video). Enquanto o arquivo não existir em public/, cai num
// fundo sólido (bg-surface-container-high) no lugar de vídeo quebrado.
function DemoVideo({ src }: { src: string }) {
  return (
    <div className="mt-md aspect-video w-full overflow-hidden rounded-sm border border-outline-variant/60 bg-surface-container-high">
      <video autoPlay muted loop playsInline className="h-full w-full object-cover">
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}

// Aba "Câmeras IA": um quadro de câmera simulado que troca de cenário
// sozinho a cada poucos segundos, com o resumo do aviso embaixo.
function CamerasTab() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((v) => (v + 1) % SCENARIOS.length), 2300);
    return () => clearInterval(timer);
  }, []);

  const s = SCENARIOS[i];
  const ev = EVENTS[s.event];
  const zone = ZONES[s.zone];
  const sev = SEVERITIES[s.severity];

  return (
    <div>
      <p className="font-medium text-on-surface">Câmeras IA</p>
      <p className="mt-xs text-body-md text-on-surface-variant">
        Use as câmeras que você já tem. A IA detecta pessoas e veículos em áreas restritas e avisa no
        WhatsApp com foto.
      </p>

      <div key={i} className="mt-md" style={{ animation: "lp-slide-up 0.3s ease-out" }}>
        <CameraTile event={s.event} zone={s.zone} severity={s.severity} variant="mini" />
      </div>

      <div className="mt-xs flex items-center gap-sm border border-outline-variant/60 bg-surface p-xs">
        <span className="h-2 w-2 shrink-0" style={{ backgroundColor: sev.color }} />
        <p className="text-body-md text-on-surface">
          <span className="font-medium">{zone.place}:</span> {ev.detected.toLowerCase()}, {sev.short}
        </p>
      </div>
    </div>
  );
}

export default function TrackingDemo() {
  const [tab, setTab] = useState<Tab>("ponto");

  useEffect(() => {
    const timer = setTimeout(() => {
      setTab((current) => {
        const i = TABS.findIndex((t) => t.id === current);
        return TABS[(i + 1) % TABS.length].id;
      });
    }, AUTO_ADVANCE_MS[tab]);
    return () => clearTimeout(timer);
  }, [tab]);

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-lowest shadow-lg">
      {/* Barra de título, estilo janela */}
      <div className="flex items-center justify-between border-b border-outline-variant/60 px-md py-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-outline-variant" />
          <span className="h-2.5 w-2.5 rounded-full bg-outline-variant" />
          <span className="h-2.5 w-2.5 rounded-full bg-outline-variant" />
        </div>
        <span className="argus-status-badge argus-mono text-label-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
          Ao vivo
        </span>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Abas — grid 2x2 centralizado no celular, lista vertical a partir de sm:. */}
        <div className="grid grid-cols-2 gap-1 border-b border-outline-variant/60 p-xs sm:flex sm:w-[200px] sm:flex-col sm:border-b-0 sm:border-r sm:p-sm">
          {TABS.map((t, index) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`argus-mono relative overflow-hidden whitespace-normal px-sm py-2 text-center text-label-sm leading-snug transition-colors sm:text-left ${
                index === TABS.length - 1 && TABS.length % 2 === 1 ? "col-span-2 sm:col-span-1" : ""
              } ${
                tab === t.id
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span
                  key={tab}
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-on-primary-container"
                  style={{ animation: `tab-fill ${AUTO_ADVANCE_MS[t.id]}ms linear forwards` }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba — altura fixa de propósito, pra não mudar de
            tamanho ao trocar de aba. */}
        <div className="h-[475px] min-h-0 overflow-hidden p-md sm:flex-1">
          {tab === "ponto" && (
            <div>
              <p className="font-medium text-on-surface">Ponto IA</p>
              <p className="mt-xs text-body-md text-on-surface-variant">
                Para equipes internas e externas, no check-in a IA confere uniforme, crachá e
                local de trabalho. Aprovado sem ninguém precisar olhar.
              </p>

              <DemoVideo src="/argus-ponto-ia.mp4" />

              <div className="mt-sm flex justify-center gap-md">
                {CHECKS.map((c) => (
                  <div key={c.label} className="w-16 shrink-0 text-center">
                    <div className="relative mx-auto aspect-square h-10 w-10">
                      <div className="relative h-full w-full overflow-hidden rounded-full bg-surface-container-high">
                        <Image src={c.img} alt={c.label} fill sizes="40px" priority className="object-cover" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-tertiary text-on-tertiary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5">
                          <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    <p className="mt-1 break-words text-label-sm text-on-surface-variant">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "dispositivos" && (
            <div>
              <div className="flex items-center justify-between">
                <p className="font-medium text-on-surface">Rastreio em tempo real</p>
                <span className="text-label-sm text-on-surface-variant">6 online</span>
              </div>
              <p className="mt-xs text-body-md text-on-surface-variant">
                Notebook e celular na última posição conhecida, com status online ou offline.
              </p>

              <DemoVideo src="/argus-rastreio.mp4" />

              <div className="mx-auto mt-sm flex max-w-[19rem] flex-wrap justify-center gap-x-lg gap-y-sm text-label-sm">
                {DEVICES_SAMPLE.map((d) => (
                  <div key={d.name} className="flex w-32 items-start gap-1.5">
                    <span className="relative mt-1 flex h-1.5 w-1.5 shrink-0">
                      <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-tertiary/60" />
                      <span className="relative block h-1.5 w-1.5 rounded-full bg-tertiary" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-on-surface">
                        {d.device} · {d.name}
                      </p>
                      <p className="truncate text-on-surface-variant">{d.city}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "cameras" && <CamerasTab />}

          {tab === "alertas" && (
            <div>
              <p className="font-medium text-on-surface">Alertas de ponto e dispositivos</p>
              <p className="mt-xs text-body-md text-on-surface-variant">
                Acompanhe situações que merecem atenção e aja no momento certo.
              </p>

              <DemoVideo src="/argus-alertas.mp4" />

              <div className="mt-xs flex flex-col gap-xs">
                {ALERTS_SAMPLE.map((a) => (
                  <div
                    key={a.text}
                    className="flex items-center gap-sm rounded-sm border border-outline-variant/60 bg-surface p-xs shadow-sm"
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className={`absolute inset-0 -m-1 animate-ping rounded-full ${a.ring}`} />
                      <span className={`relative block h-2 w-2 rounded-full ${a.color}`} />
                    </span>
                    <p className="text-body-md text-on-surface">
                      <span className="font-medium">{a.who}</span> {a.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "uso" && (
            <div>
              <p className="font-medium text-on-surface">Uso Digital</p>
              <p className="mt-xs text-body-md text-on-surface-variant">
                Descubra em quais sistemas e sites o tempo da equipe é mais investido ao longo
                da jornada.
              </p>

              <DemoVideo src="/argus-uso-digital.mp4" />

              <div className="mt-xs flex flex-col gap-1">
                {USAGE_SAMPLE.map((u) => (
                  <div key={u.site} className="flex items-center gap-sm text-label-sm">
                    <span className="w-36 shrink-0 truncate text-on-surface">{u.site}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${u.pct}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-on-surface-variant">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
