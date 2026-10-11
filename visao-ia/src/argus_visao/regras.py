"""Tracking e regras de contagem de UMA câmera.

Métricas, em ordem de confiabilidade:
  1. Entradas/saídas por LINHA: pessoa cruzou a linha configurada. Não
     depende de o ID se manter estável a vida toda, só durante o
     cruzamento. É a métrica principal nas entradas.
  2. Ocupação por ZONA e na imagem inteira: quantas pessoas estão lá
     AGORA. Também não depende de IDs estáveis.
  3. Visitantes únicos (ESTIMATIVA): quantos tracks diferentes duraram
     pelo menos `min_track_duration_s`. Sensível a troca de ID (oclusão,
     pessoa sumindo atrás de pilar), por isso sempre rotulada como
     estimativa.

Durações são medidas em SEGUNDOS pelo timestamp da captura, não em
quadros, pra não depender do fps de análise.
"""

from __future__ import annotations

import warnings
from collections import deque
from dataclasses import dataclass

import numpy as np
import supervision as sv

from .config import CameraConfig, TrackerConfig

# sv.ByteTrack está marcado como obsoleto desde o supervision 0.28 (vai
# pro pacote `trackers`), mas funciona na versão fixada no pyproject.
warnings.filterwarnings("ignore", category=FutureWarning, module="supervision")

# Descarta da memória tracks não vistos há mais que isso (já foram contados).
ESQUECER_TRACK_APOS_S = 30.0


@dataclass
class _Track:
    primeiro_ts: float
    ultimo_ts: float
    contado: bool = False

    @property
    def duracao_s(self) -> float:
        return self.ultimo_ts - self.primeiro_ts


def criar_bytetrack(cfg: TrackerConfig, fps_analise: float) -> sv.ByteTrack:
    return sv.ByteTrack(
        track_activation_threshold=cfg.track_activation_threshold,
        lost_track_buffer=cfg.lost_track_buffer(),
        minimum_matching_threshold=cfg.minimum_matching_threshold,
        frame_rate=fps_analise,
        minimum_consecutive_frames=cfg.minimum_consecutive_frames(fps_analise),
    )


class RegrasCamera:
    def __init__(self, camera: CameraConfig, cfg: TrackerConfig, fps_analise: float) -> None:
        self.camera = camera
        self.cfg = cfg
        self.fps_analise = fps_analise
        self.tracker = criar_bytetrack(cfg, fps_analise)
        self._tamanho: tuple[int, int] | None = None
        self._linhas: dict[str, sv.LineZone] = {}
        self._zonas: dict[str, sv.PolygonZone] = {}
        self._zerar_contadores()

    def _zerar_contadores(self) -> None:
        self._tracks: dict[int, _Track] = {}
        self.visitantes_estimados = 0
        self.ids_criados = 0
        self.ocupacao = 0
        self.ocupacao_zonas: dict[str, int] = {z.id: 0 for z in self.camera.zonas}
        # Duração dos tracks já encerrados (pro relatório de debug)
        self.duracoes_encerradas: deque[float] = deque(maxlen=500)
        if self._tamanho:
            self._montar_geometria(*self._tamanho)

    def zerar(self) -> None:
        self.tracker.reset()
        self._zerar_contadores()

    def _montar_geometria(self, largura: int, altura: int) -> None:
        self._tamanho = (largura, altura)
        self._linhas = {
            l.id: sv.LineZone(
                start=sv.Point(l.inicio[0] * largura, l.inicio[1] * altura),
                end=sv.Point(l.fim[0] * largura, l.fim[1] * altura),
                triggering_anchors=(sv.Position.BOTTOM_CENTER,),
            )
            for l in self.camera.linhas
        }
        self._zonas = {
            z.id: sv.PolygonZone(
                polygon=np.array([[x * largura, y * altura] for x, y in z.poligono], dtype=np.int64),
                triggering_anchors=(sv.Position.BOTTOM_CENTER,),
            )
            for z in self.camera.zonas
        }

    def atualizar(self, deteccoes: sv.Detections, ts: float, largura: int, altura: int) -> sv.Detections:
        if self._tamanho != (largura, altura):
            self._montar_geometria(largura, altura)

        rastreadas = self.tracker.update_with_detections(deteccoes)
        if rastreadas.tracker_id is None:
            rastreadas.tracker_id = np.array([], dtype=int)

        for tid in rastreadas.tracker_id.tolist():
            t = self._tracks.get(tid)
            if t is None:
                t = self._tracks[tid] = _Track(primeiro_ts=ts, ultimo_ts=ts)
                self.ids_criados += 1
            t.ultimo_ts = ts
            if not t.contado and t.duracao_s >= self.cfg.min_track_duration_s:
                t.contado = True
                self.visitantes_estimados += 1

        for tid in [tid for tid, t in self._tracks.items() if ts - t.ultimo_ts > ESQUECER_TRACK_APOS_S]:
            self.duracoes_encerradas.append(self._tracks.pop(tid).duracao_s)

        for linha in self._linhas.values():
            linha.trigger(rastreadas)
        for zid, zona in self._zonas.items():
            zona.trigger(rastreadas)
            self.ocupacao_zonas[zid] = int(zona.current_count)
        self.ocupacao = len(rastreadas)
        return rastreadas

    def duracoes_ativas(self) -> dict[int, float]:
        return {tid: round(t.duracao_s, 1) for tid, t in self._tracks.items()}

    def estatisticas(self) -> dict:
        todas = list(self.duracoes_encerradas) + [t.duracao_s for t in self._tracks.values()]
        return {
            "ocupacao_atual": self.ocupacao,
            "ocupacao_zonas": [{"id": z.id, "nome": z.nome, "ocupacao": self.ocupacao_zonas.get(z.id, 0)} for z in self.camera.zonas],
            "linhas": [
                {"id": l.id, "nome": l.nome, "entradas": int(self._linhas[l.id].in_count), "saidas": int(self._linhas[l.id].out_count)}
                for l in self.camera.linhas
                if l.id in self._linhas
            ],
            "visitantes_unicos_estimado": self.visitantes_estimados,
            "ids_criados": self.ids_criados,
            "duracao_media_track_s": round(sum(todas) / len(todas), 1) if todas else None,
            # Só tracks já encerrados: um track ativo ainda pode crescer.
            "tracks_curtos_encerrados": sum(1 for d in self.duracoes_encerradas if d < self.cfg.min_track_duration_s),
        }
