"use client";

import { useState, type ReactNode } from "react";
import CameraTile from "./CameraTile";
import { useClock, formatClock } from "./useClock";
import {
  EVENTS,
  ZONES,
  SEVERITIES,
  SCENARIOS,
  type EventKey,
  type ZoneKey,
  type SeverityKey,
} from "./cameraData";

// Simulador do módulo Câmeras IA: a pessoa escolhe o que a câmera
// detectou, onde e qual a severidade, e vê na hora o quadro da câmera
// e o aviso que chegaria no WhatsApp (ou o registro no painel, no caso
// "Informativo"). Tudo simulado no navegador, sem backend.

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const EVENT_ICONS: Record<EventKey, ReactNode> = {
  pessoa: (
    <Svg>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
    </Svg>
  ),
  veiculo: (
    <Svg>
      <path d="M4 17v-4l2-5h12l2 5v4M3 17h18M7 17v2M17 17v2" />
      <path d="M4 13h16" />
    </Svg>
  ),
  moto: (
    <Svg>
      <circle cx="6" cy="16" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="M6 16l4-7h4l4 7M10 9L9 7H7M14 9h3" />
    </Svg>
  ),
};

const ZONE_ICONS: Record<ZoneKey, ReactNode> = {
  muro: (
    <Svg>
      <path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6" />
    </Svg>
  ),
  portao: (
    <Svg>
      <path d="M6 21V4h12v17M4 21h16M15 12v.5" />
    </Svg>
  ),
  garagem: (
    <Svg>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />
    </Svg>
  ),
};

function Option({
  selected,
  onClick,
  icon,
  dotColor,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  dotColor?: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex flex-col gap-1 border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-tertiary bg-primary-container"
          : "border-outline-variant/60 hover:border-outline"
      }`}
    >
      <span className="flex items-center gap-2 text-label-md text-on-surface">
        {icon && <span className={selected ? "text-tertiary" : "text-on-surface-variant"}>{icon}</span>}
        {dotColor && <span className="h-2 w-2 shrink-0" style={{ backgroundColor: dotColor }} />}
        {label}
      </span>
      <span className="argus-mono text-[10px] leading-snug text-on-surface-variant">{hint}</span>
    </button>
  );
}

function Group({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-label-md text-on-surface">{title}</p>
      <div role="radiogroup" aria-label={label} className="mt-2 grid gap-2 sm:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[#25D366]" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.81 2.01.88 2.16.07.14.11.31.02.5-.09.19-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.29.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.29.14.46.12.63-.07.18-.19.75-.87.95-1.17.19-.29.39-.24.65-.14.27.09 1.7.8 1.99.95.29.14.48.22.55.34.07.13.07.72-.17 1.4z" />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="argus-mono w-24 shrink-0 pt-0.5 text-[10px] text-on-surface-variant">{label}</span>
      <span className="text-body-md text-on-surface">{value}</span>
    </div>
  );
}

function AlertCard({
  event,
  zone,
  severity,
}: {
  event: EventKey;
  zone: ZoneKey;
  severity: SeverityKey;
}) {
  const now = useClock();
  const ev = EVENTS[event];
  const z = ZONES[zone];
  const sev = SEVERITIES[severity];
  const isPanel = severity === "info";

  return (
    <div className="border border-outline-variant bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/60 px-3 py-2">
        <div className="flex items-center gap-2">
          {isPanel ? (
            <span className="h-2 w-2 shrink-0 bg-tertiary" />
          ) : (
            <WhatsAppGlyph />
          )}
          <div className="leading-tight">
            <p className="text-label-md text-on-surface">{isPanel ? "Painel Argus" : "Argus Alertas"}</p>
            <p className="argus-mono text-[10px] text-on-surface-variant">
              {isPanel ? "Registro de ocorrência" : "Notificação instantânea"}
            </p>
          </div>
        </div>
        <span className="argus-mono text-[10px] text-on-surface-variant">{formatClock(now)}</span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="max-w-[300px]">
          <CameraTile event={event} zone={zone} severity={severity} variant="compact" />
          <p className="argus-mono mt-1 text-[10px] text-on-surface-variant">
            {isPanel ? "Imagem salva no painel" : "Foto capturada da câmera"}
          </p>
        </div>

        <p className="argus-mono text-label-sm" style={{ color: sev.color }}>
          {sev.tag}
        </p>

        <div className="flex flex-col gap-2">
          <Row label="Câmera" value={z.camera} />
          <Row label="Detecção" value={`${ev.detected} (99% de certeza)`} />
          <Row label="Regra" value={z.rule} />
          <Row label="Instrução" value={sev.instruction} />
        </div>

        <p className="flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-2 text-body-md text-on-surface-variant">
          <span>
            {isPanel
              ? "Registrado no painel. Nenhum aviso enviado."
              : "Foto da ocorrência capturada e enviada em menos de 3 segundos."}
          </span>
          {!isPanel && <span className="shrink-0 text-tertiary">✓✓</span>}
        </p>
      </div>
    </div>
  );
}

export default function CameraSimulator() {
  const [event, setEvent] = useState<EventKey>("pessoa");
  const [zone, setZone] = useState<ZoneKey>("muro");
  const [severity, setSeverity] = useState<SeverityKey>("critico");

  return (
    <div className="grid border border-outline-variant/60 bg-surface lg:grid-cols-2">
      <div className="flex flex-col gap-md p-md">
        <Group title="1. O que a câmera detectou?" label="Tipo de detecção">
          {(Object.keys(EVENTS) as EventKey[]).map((key) => (
            <Option
              key={key}
              selected={event === key}
              onClick={() => setEvent(key)}
              icon={EVENT_ICONS[key]}
              label={EVENTS[key].label}
              hint={EVENTS[key].hint}
            />
          ))}
        </Group>

        <Group title="2. Onde ocorreu a detecção?" label="Local da detecção">
          {(Object.keys(ZONES) as ZoneKey[]).map((key) => (
            <Option
              key={key}
              selected={zone === key}
              onClick={() => setZone(key)}
              icon={ZONE_ICONS[key]}
              label={ZONES[key].label}
              hint={ZONES[key].hint}
            />
          ))}
        </Group>

        <Group title="3. Nível de severidade da regra" label="Severidade">
          {(Object.keys(SEVERITIES) as SeverityKey[]).map((key) => (
            <Option
              key={key}
              selected={severity === key}
              onClick={() => setSeverity(key)}
              dotColor={SEVERITIES[key].color}
              label={SEVERITIES[key].label}
              hint={SEVERITIES[key].hint}
            />
          ))}
        </Group>

        <div className="border-t border-outline-variant/60 pt-md">
          <p className="argus-mono text-[10px] text-on-surface-variant">Cenários rápidos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCENARIOS.map((s) => {
              const active = s.event === event && s.zone === zone && s.severity === severity;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setEvent(s.event);
                    setZone(s.zone);
                    setSeverity(s.severity);
                  }}
                  className={`argus-mono border px-3 py-1.5 text-[10px] transition-colors ${
                    active
                      ? "border-tertiary text-tertiary"
                      : "border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-outline-variant/60 p-md lg:border-l lg:border-t-0">
        <div
          key={`${event}-${zone}-${severity}`}
          style={{ animation: "lp-slide-up 0.35s ease-out" }}
          className="flex flex-col gap-sm"
        >
          <CameraTile event={event} zone={zone} severity={severity} variant="full" />
          <AlertCard event={event} zone={zone} severity={severity} />
        </div>
      </div>
    </div>
  );
}
