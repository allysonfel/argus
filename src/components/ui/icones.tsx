import type { SVGProps } from 'react';

// Ícones de linha simples (18px, stroke 1.75 por padrão) — ver DESIGN.md
// "nav-icon". Sem lib externa: só o que a sidebar/telas do Argus precisam.
type IconeProps = SVGProps<SVGSVGElement> & { strokeWidth?: number };

function Base({ children, strokeWidth = 1.75, ...props }: IconeProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeVisaoGeral = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </Base>
);

export const IconePonto = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Base>
);

export const IconeMapaPin = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </Base>
);

export const IconeMapa = (p: IconeProps) => (
  <Base {...p}>
    <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4z" />
    <path d="M9 4v13M15 7v13" />
  </Base>
);

export const IconeAtividade = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 12h4l2 8 4-16 2 8h6" />
  </Base>
);

export const IconePredio = (p: IconeProps) => (
  <Base {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
  </Base>
);

export const IconeConfig = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9c.1.4.29.75.55 1.02" />
  </Base>
);

export const IconeSair = (p: IconeProps) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Base>
);

export const IconePessoas = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17.5" cy="9" r="2.6" />
    <path d="M15.9 13.2a5.2 5.2 0 0 1 5.6 5.2" />
  </Base>
);

export const IconeLaptop = (p: IconeProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="10" rx="1" />
    <path d="M2 19.5h20L20.5 16h-17L2 19.5z" />
  </Base>
);

export const IconeAlerta = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 3 2 20h20L12 3z" />
    <path d="M12 10v4" />
    <path d="M12 17.5h.01" />
  </Base>
);

export const IconeCheck = (p: IconeProps) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const IconeX = (p: IconeProps) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

export const IconeBusca = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Base>
);

export const IconeCalendario = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </Base>
);

export const IconeSeta = (p: IconeProps) => (
  <Base {...p}>
    <path d="m9 18 6-6-6-6" />
  </Base>
);

export const IconeMais = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconeCamera = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="14" r="3.5" />
  </Base>
);

export const IconeAssinatura = (p: IconeProps) => (
  <Base {...p}>
    <path d="M3 17s2-1 4-1 3 2 5 2 3-2 5-2 4 1 4 1" />
    <path d="M4 12 14 2l3 3L7 15H4v-3z" />
  </Base>
);

export const IconeSol = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
  </Base>
);

export const IconeLua = (p: IconeProps) => (
  <Base {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Base>
);

export const IconeCalor = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-2 1-3 1.5-4 .5 1.5 1.5 2 2.5 2 0-2-1-4 0-6.5z" />
    <path d="M5 21h14" />
  </Base>
);

export const IconeZonaMorta = (p: IconeProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M8 16l3-4 2 2 3-5" />
    <path d="M3 3l18 18" />
  </Base>
);

export const IconeComparar = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Base>
);

export const IconeRotas = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
  </Base>
);

export const IconeEscudo = (p: IconeProps) => (
  <Base {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z" />
    <path d="M12 8v5M12 16h.01" />
  </Base>
);

export const IconeCrianca = (p: IconeProps) => (
  <Base {...p}>
    <circle cx="10" cy="5" r="2" />
    <path d="M10 8v6M7 11h6M10 14l-2 6M10 14l2 6" />
    <circle cx="17.5" cy="15.5" r="3" />
    <path d="M20 18l2 2" />
  </Base>
);

export const IconeLoja = (p: IconeProps) => (
  <Base {...p}>
    <path d="M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9" />
    <path d="M9 20v-6h6v6" />
  </Base>
);
