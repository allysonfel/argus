// DADOS DE DEMONSTRAÇÃO de segurança e saúde das câmeras: alertas de
// áreas restritas, estado de cada câmera e descritores leves de pessoas
// (busca de criança perdida). Determinísticos, como o resto de demo.ts.

import { agoraDemo, hash, somarDias } from './demo';
import { AREAS_RESTRITAS, CAMERAS, ZONAS, centro, type Andar } from './planta';

// ---------- áreas restritas ----------

export type StatusAlerta = 'novo' | 'atendimento' | 'resolvido' | 'falso';
export type Alerta = {
  id: string;
  areaId: string;
  cameraId: string;
  tipo: 'Pessoa em área restrita' | 'Câmera tapada ou escura' | 'Câmera desviada' | 'Câmera offline';
  prioridade: 'alta' | 'media';
  quando: string; // "AAAA-MM-DD HH:MM"
  confiancaPct: number;
  permanenciaS: number;
  status: StatusAlerta;
  responsavel?: string;
  observacao?: string;
};

export const ROTULO_STATUS: Record<StatusAlerta, string> = { novo: 'Novo', atendimento: 'Em atendimento', resolvido: 'Resolvido', falso: 'Falso alarme' };

export function alertasDemo(): Alerta[] {
  const hoje = agoraDemo().data;
  const ontem = somarDias(hoje, -1);
  const d = (n: number) => somarDias(hoje, -n);
  return [
    { id: 'AL-1042', areaId: 'ar-doca', cameraId: 'CAM-T-21', tipo: 'Pessoa em área restrita', prioridade: 'alta', quando: `${hoje} 03:12`, confiancaPct: 91, permanenciaS: 48, status: 'novo' },
    { id: 'AL-1041', areaId: 'ar-telhado', cameraId: 'CAM-P1-14', tipo: 'Câmera tapada ou escura', prioridade: 'alta', quando: `${hoje} 01:47`, confiancaPct: 100, permanenciaS: 0, status: 'atendimento', responsavel: 'Carlos (ronda noturna)' },
    { id: 'AL-1040', areaId: 'ar-tesouraria', cameraId: 'CAM-T-22', tipo: 'Pessoa em área restrita', prioridade: 'alta', quando: `${ontem} 23:58`, confiancaPct: 84, permanenciaS: 12, status: 'falso', responsavel: 'Marta', observacao: 'Equipe de limpeza autorizada, fora da janela cadastrada.' },
    { id: 'AL-1039', areaId: 'ar-doca', cameraId: 'CAM-T-21', tipo: 'Pessoa em área restrita', prioridade: 'alta', quando: `${d(2)} 05:31`, confiancaPct: 88, permanenciaS: 95, status: 'resolvido', responsavel: 'Carlos (ronda noturna)', observacao: 'Fornecedor chegou antes do horário. Liberado pela portaria.' },
    { id: 'AL-1038', areaId: 'ar-doca', cameraId: 'CAM-T-21', tipo: 'Pessoa em área restrita', prioridade: 'alta', quando: `${d(3)} 02:10`, confiancaPct: 72, permanenciaS: 9, status: 'falso', responsavel: 'Marta', observacao: 'Gato. Ajustar permanência mínima.' },
    { id: 'AL-1037', areaId: 'ar-telhado', cameraId: 'CAM-P1-14', tipo: 'Câmera desviada', prioridade: 'alta', quando: `${d(5)} 14:22`, confiancaPct: 100, permanenciaS: 0, status: 'resolvido', responsavel: 'Manutenção', observacao: 'Suporte frouxo, câmera reposicionada.' },
    { id: 'AL-1036', areaId: 'ar-tesouraria', cameraId: 'CAM-T-22', tipo: 'Pessoa em área restrita', prioridade: 'alta', quando: `${d(6)} 22:41`, confiancaPct: 93, permanenciaS: 30, status: 'resolvido', responsavel: 'Marta', observacao: 'Funcionário da tesouraria em hora extra, sem aviso prévio.' },
  ];
}

export type JanelaManutencao = { areaId: string; inicio: string; fim: string; motivo: string; agendadoPor: string };

export function manutencoesDemo(): JanelaManutencao[] {
  const hoje = agoraDemo().data;
  return [
    { areaId: 'ar-telhado', inicio: `${somarDias(hoje, 2)} 08:00`, fim: `${somarDias(hoje, 2)} 12:00`, motivo: 'Manutenção do ar-condicionado central', agendadoPor: 'Operações (João)' },
    { areaId: 'ar-doca', inicio: `${somarDias(hoje, 1)} 06:00`, fim: `${somarDias(hoje, 1)} 07:30`, motivo: 'Entrega programada de mobiliário', agendadoPor: 'Administração (Paula)' },
  ];
}

export const REGRAS_ANTI_FALSO = {
  confiancaMinimaPct: 70,
  permanenciaMinimaS: 5,
  quadrosConsecutivos: 8,
  infravermelho: 'Modelo noturno ativado entre 18h e 6h (imagem em preto e branco)',
  retencaoEvidenciaDias: 30,
  clipeSegundos: 10,
};

export function nomeAreaRestrita(id: string) {
  return AREAS_RESTRITAS.find((a) => a.id === id)?.nome ?? id;
}

// ---------- saúde das câmeras ----------

export type EstadoCamera = 'online' | 'sem-frames' | 'offline' | 'escura' | 'desfocada' | 'desviada';
export type SaudeCamera = { id: string; nome: string; andar: Andar; estado: EstadoCamera; fps: number; ultimoFrameS: number; fonte: string; restrita: boolean };

export const ROTULO_ESTADO: Record<EstadoCamera, string> = {
  online: 'Online',
  'sem-frames': 'Sem frames',
  offline: 'Offline',
  escura: 'Escura ou tapada',
  desfocada: 'Desfocada',
  desviada: 'Desviada',
};

const ESTADOS_FIXOS: Record<string, EstadoCamera> = {
  'CAM-T-07': 'offline',
  'CAM-P1-05': 'sem-frames',
  'CAM-T-12': 'desfocada',
  'CAM-P1-09': 'desviada',
  'CAM-P1-14': 'escura',
};

export function saudeCameras(): SaudeCamera[] {
  return CAMERAS.map((c, i) => {
    const estado = ESTADOS_FIXOS[c.id] ?? 'online';
    const canal = i + 1;
    const nvr = canal <= 16 ? 1 : 2;
    return {
      id: c.id,
      nome: c.nome,
      andar: c.andar,
      estado,
      fps: estado === 'offline' ? 0 : estado === 'sem-frames' ? 0 : Math.round((3.6 + 0.8 * hash(c.id + 'fps')) * 10) / 10,
      ultimoFrameS: estado === 'offline' ? 3 * 3600 + 1240 : estado === 'sem-frames' ? 7 * 60 + 20 : Math.round(hash(c.id + 'ult') * 2 * 10) / 10,
      fonte: `rtsp://***@10.20.${nvr}.10:554/cam/realmonitor?channel=${canal <= 16 ? canal : canal - 16}&subtype=1`,
      restrita: c.zonas.length === 0,
    };
  });
}

// ---------- descritores leves (busca de criança perdida) ----------

export const CORES = ['azul', 'vermelho', 'preto', 'branco', 'verde', 'amarelo', 'rosa', 'cinza', 'laranja', 'roxo', 'marrom'] as const;
export type Cor = (typeof CORES)[number];
export const HEX_COR: Record<Cor, string> = {
  azul: '#2f6fd6',
  vermelho: '#d13c3c',
  preto: '#222222',
  branco: '#f2f2f2',
  verde: '#2e9e5b',
  amarelo: '#f2c230',
  rosa: '#e87bb5',
  cinza: '#8c8c8c',
  laranja: '#ec7a2c',
  roxo: '#7a4fc4',
  marrom: '#7a5233',
};

export type Descritor = { id: string; cima: Cor; baixo: Cor; estatura: 'crianca' | 'adulto'; alturaCm: number; cameraId: string; cameraNome: string; andar: Andar; x: number; y: number; minutosAtras: number };

const BAIXOS: Cor[] = ['preto', 'azul', 'cinza', 'branco', 'marrom', 'verde', 'vermelho', 'rosa'];

/** Pessoas vistas nas últimas 2 h (buffer temporário). Nada de rosto. */
export function descritoresRecentes(): Descritor[] {
  const cams = CAMERAS.filter((c) => c.zonas.length);
  return Array.from({ length: 320 }, (_, i) => {
    const h = (k: string) => hash(`p${i}${k}`);
    const crianca = h('e') < 0.18;
    const cam = cams[Math.floor(h('c') * cams.length)];
    const zona = ZONAS.find((z) => z.id === cam.zonas[Math.floor(h('z') * cam.zonas.length)])!;
    const [cx, cy] = centro(zona.rect);
    return {
      id: `P${String(i).padStart(4, '0')}`,
      cima: CORES[Math.floor(h('a') * CORES.length)],
      baixo: BAIXOS[Math.floor(Math.pow(h('b'), 1.6) * BAIXOS.length)], // calças/bermudas: mais preto, azul e cinza
      estatura: crianca ? 'crianca' : 'adulto',
      alturaCm: crianca ? Math.round(95 + 40 * h('h')) : Math.round(155 + 30 * h('h')),
      cameraId: cam.id,
      cameraNome: cam.nome,
      andar: cam.andar,
      x: cx + (h('x') - 0.5) * zona.rect.w * 0.7,
      y: cy + (h('y') - 0.5) * zona.rect.h * 0.7,
      minutosAtras: Math.floor(h('t') * 120),
    };
  });
}
