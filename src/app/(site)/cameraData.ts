// Dados simulados do módulo Câmeras IA (demonstração no hero e no
// simulador interativo). Nada aqui vem de câmera de verdade: são
// cenários fixos pra mostrar como o Argus detecta e avisa.

export type EventKey = "pessoa" | "veiculo" | "moto";
export type ZoneKey = "muro" | "portao" | "garagem";
export type SeverityKey = "critico" | "atencao" | "info";

export const EVENTS: Record<
  EventKey,
  {
    label: string;
    hint: string;
    detected: string;
    boxLabel: string;
    box: { w: number; h: number };
  }
> = {
  pessoa: {
    label: "Pessoa suspeita",
    hint: "Intrusão / pedestre",
    detected: "Pessoa detectada",
    boxLabel: "Pessoa 99%",
    box: { w: 12, h: 38 },
  },
  veiculo: {
    label: "Veículo não autorizado",
    hint: "Carro / caminhão",
    detected: "Veículo detectado",
    boxLabel: "Veículo 99%",
    box: { w: 34, h: 30 },
  },
  moto: {
    label: "Motocicleta",
    hint: "Entrega / perímetro",
    detected: "Motocicleta detectada",
    boxLabel: "Moto 99%",
    box: { w: 20, h: 26 },
  },
};

export const ZONES: Record<
  ZoneKey,
  {
    label: string;
    hint: string;
    place: string;
    camera: string;
    rule: string;
    polygon: string;
    anchor: { left: number; top: number };
  }
> = {
  muro: {
    label: "Muro dos fundos",
    hint: "Cerca virtual / transposição",
    place: "Muro dos fundos",
    camera: "Câmera 03 · Perímetro norte",
    rule: "Intrusão em perímetro (22h às 06h)",
    polygon: "8,56 152,48 156,74 4,76",
    anchor: { left: 44, top: 40 },
  },
  portao: {
    label: "Portão principal",
    hint: "Acesso fora de horário",
    place: "Portão principal",
    camera: "Câmera 01 · Portaria principal",
    rule: "Acesso fora do horário permitido",
    polygon: "48,26 112,26 122,80 38,80",
    anchor: { left: 38, top: 36 },
  },
  garagem: {
    label: "Garagem / doca",
    hint: "Pátio de cargas",
    place: "Garagem / doca",
    camera: "Câmera 04 · Doca de cargas",
    rule: "Movimentação em área restrita",
    polygon: "16,32 144,32 144,80 16,80",
    anchor: { left: 32, top: 42 },
  },
};

// Cores de severidade vêm do guia do tema (coral, violeta, verde LED) e
// ficam em variáveis CSS em site-theme.css.
export const SEVERITIES: Record<
  SeverityKey,
  {
    label: string;
    hint: string;
    tag: string;
    instruction: string;
    short: string;
    color: string;
  }
> = {
  critico: {
    label: "Crítico",
    hint: "WhatsApp + foto para toda a equipe",
    tag: "Alerta crítico",
    instruction: "Acionar imediatamente a equipe responsável e verificar o local.",
    short: "foto enviada no WhatsApp",
    color: "var(--argus-sev-critical)",
  },
  atencao: {
    label: "Atenção",
    hint: "WhatsApp + foto para o responsável",
    tag: "Alerta de atenção",
    instruction: "Verificar a ocorrência assim que possível.",
    short: "foto enviada no WhatsApp",
    color: "var(--argus-sev-attention)",
  },
  info: {
    label: "Informativo",
    hint: "Registro no painel",
    tag: "Registro informativo",
    instruction: "Ocorrência registrada no painel para consulta.",
    short: "registro salvo no painel",
    color: "var(--argus-sev-info)",
  },
};

export type Scenario = {
  label: string;
  event: EventKey;
  zone: ZoneKey;
  severity: SeverityKey;
};

export const SCENARIOS: Scenario[] = [
  { label: "Invasão noturna (muro)", event: "pessoa", zone: "muro", severity: "critico" },
  { label: "Veículo suspeito (portão)", event: "veiculo", zone: "portao", severity: "atencao" },
  { label: "Moto na doca (registro)", event: "moto", zone: "garagem", severity: "info" },
];
