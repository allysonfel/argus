"use client";

import { useClock, formatStamp } from "./useClock";
import { EVENTS, ZONES, SEVERITIES, type EventKey, type ZoneKey, type SeverityKey } from "./cameraData";

// Quadro de câmera simulado (sem vídeo): grade sutil, zona demarcada
// tracejada, caixa de detecção com rótulo e, na variante completa,
// legendas de câmera/hora. A cor da zona e da caixa segue a severidade.
//   full    = todas as legendas (simulador)
//   mini    = só câmera + hora (aba do hero, espaço curto)
//   compact = só a detecção (foto dentro do aviso do WhatsApp)
type Variant = "full" | "mini" | "compact";

const GRID =
  "linear-gradient(to right, var(--color-outline-variant) 1px, transparent 1px), linear-gradient(to bottom, var(--color-outline-variant) 1px, transparent 1px)";

export default function CameraTile({
  event,
  zone,
  severity,
  variant = "full",
}: {
  event: EventKey;
  zone: ZoneKey;
  severity: SeverityKey;
  variant?: Variant;
}) {
  const now = useClock();
  const ev = EVENTS[event];
  const z = ZONES[zone];
  const color = SEVERITIES[severity].color;
  const showTop = variant !== "compact";
  const showFull = variant === "full";

  return (
    <div className="relative aspect-video w-full overflow-hidden border border-outline-variant bg-surface-dim">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: GRID, backgroundSize: "28px 28px" }}
      />

      <svg
        aria-hidden
        viewBox="0 0 160 90"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ color }}
      >
        <polygon
          points={z.polygon}
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {variant !== "compact" && <div aria-hidden className="argus-scan absolute inset-x-0 h-px bg-tertiary/40" />}

      <div
        className="argus-box-in absolute border"
        style={{
          left: `${z.anchor.left}%`,
          top: `${z.anchor.top}%`,
          width: `${ev.box.w}%`,
          height: `${ev.box.h}%`,
          borderColor: color,
        }}
      >
        <span
          className="argus-mono absolute -left-px -top-[15px] whitespace-nowrap px-1 text-[9px] leading-[14px]"
          style={{ backgroundColor: color, color: "#0b0e12" }}
        >
          {ev.boxLabel}
        </span>
      </div>

      {showTop && (
        <span className="argus-mono absolute left-2 top-2 border border-outline-variant/60 bg-surface/80 px-1.5 py-0.5 text-[9px] text-on-surface">
          {z.camera}
        </span>
      )}
      {showFull && (
        <span className="argus-mono absolute right-2 top-2 flex items-center gap-1.5 text-[9px] text-on-surface-variant">
          <span className="h-1.5 w-1.5 bg-tertiary" />
          IA ativa · 30 fps
        </span>
      )}
      {showFull && (
        <span className="argus-mono absolute bottom-2 left-2 text-[9px] text-on-surface-variant">{z.place}</span>
      )}
      {showTop && (
        <span className="argus-mono absolute bottom-2 right-2 text-[9px] text-on-surface-variant">
          {formatStamp(now)}
        </span>
      )}
    </div>
  );
}
