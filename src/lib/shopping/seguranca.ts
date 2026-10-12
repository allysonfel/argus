// DADOS DE DEMONSTRAÇÃO da saúde das câmeras (estado de cada câmera).
// Determinísticos, como o resto de demo.ts. A busca de criança perdida usa
// os casos reais do motor (casos.ts).

import { hash } from './demo';
import { CAMERAS, type Andar } from './planta';

// ---------- saúde das câmeras ----------

export type EstadoCamera = 'online' | 'sem-frames' | 'offline' | 'escura' | 'desfocada' | 'desviada';
export type SaudeCamera = { id: string; nome: string; andar: Andar; estado: EstadoCamera; fps: number; ultimoFrameS: number; fonte: string };

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
  'CAM-T-03': 'escura',
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
    };
  });
}
