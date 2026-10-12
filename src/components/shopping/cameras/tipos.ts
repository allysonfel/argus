import { ANDARES } from '@/lib/shopping/planta';

export type Ponto = [number, number];

export type StatsCamera = {
  ocupacao_atual: number;
  pessoas_detectadas: number;
  ocupacao_zonas: { id: string; nome: string; ocupacao: number }[];
  linhas: { id: string; nome: string; entradas: number; saidas: number }[];
  visitantes_unicos_estimado: number;
  ids_criados: number;
  ids_costurados?: number;
  trocas_desfeitas?: number;
  duracao_media_track_s: number | null;
  tracks_curtos_encerrados: number;
};

export type CameraMotor = {
  id: string;
  nome: string;
  andar: string | null;
  corredor: string | null;
  area_negocio: string | null;
  credito: string | null;
  online: boolean;
  erro: string | null;
  tipo_fonte: string;
  fps_fonte: number;
  fps_captura: number;
  fps_analise: number;
  sem_quadros_ha_s: number | null;
  resolucao: [number, number];
  linhas: { id: string; nome: string; inicio: Ponto; fim: Ponto }[];
  zonas: { id: string; nome: string; poligono: Ponto[] }[];
  stats: StatsCamera;
};

/** Quantas câmeras ganham o destaque "mais movimento" e o mínimo de pessoas pra entrar. */
export const DESTAQUES_MAX = 3;
export const DESTAQUE_MIN_PESSOAS = 5;

export function nomeAndar(andar: string | null): string | null {
  if (!andar) return null;
  return ANDARES.find((a) => a.id === andar)?.nome ?? andar;
}

/** "CAM 05 · Átrio de eventos" -> { codigo: "CAM 05", titulo: "Átrio de eventos" } */
export function partesDoNome(nome: string): { codigo: string | null; titulo: string } {
  const m = nome.match(/^(CAM\s*\d+)\s*·\s*(.+)$/i);
  return m ? { codigo: m[1], titulo: m[2] } : { codigo: null, titulo: nome };
}

export function localDaCamera(c: CameraMotor): string {
  return [nomeAndar(c.andar), c.corredor, c.area_negocio].filter(Boolean).join(' · ');
}

export function pessoasNaImagem(c: CameraMotor): number {
  return c.stats.pessoas_detectadas ?? c.stats.ocupacao_atual;
}

/** As câmeras mais cheias agora (relativo às demais, não um número fixo). */
export function camerasEmDestaque(cameras: CameraMotor[]): Set<string> {
  return new Set(
    cameras
      .filter((c) => c.online && pessoasNaImagem(c) >= DESTAQUE_MIN_PESSOAS)
      .sort((a, b) => pessoasNaImagem(b) - pessoasNaImagem(a))
      .slice(0, DESTAQUES_MAX)
      .map((c) => c.id)
  );
}
