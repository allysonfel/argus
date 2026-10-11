"""Núcleo de detecção + tracking, compartilhado entre o painel ao vivo
(rastreio.py/app.py) e os scripts de diagnóstico/validação. Existir
separado evita ter duas implementações divergentes do mesmo pipeline.

Dois backends de tracking, escolhidos por TrackerConfig.tracker_tipo:
  - "bytetrack":   supervision ByteTrack (só movimento/IoU, mais leve)
  - "botsort_reid": BoT-SORT da ultralytics, com Re-ID de aparência
                     ligado (reassocia a mesma pessoa depois de uma
                     oclusão mais longa, não só por posição/velocidade)
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

import cv2
import numpy as np
import supervision as sv
import yaml
from ultralytics import YOLO

from config import TrackerConfig

PERSON_CLASS_ID = 0  # COCO: 0 = person
_BOTSORT_YAML_GERADO = Path(__file__).parent / "_botsort_reid_gerado.yaml"


class TrackerAdapter(Protocol):
    def update(self, frame: np.ndarray) -> sv.Detections: ...
    def reset(self) -> None: ...


class ByteTrackAdapter:
    """Backend padrão: detector YOLO + sv.ByteTrack (movimento/IoU)."""

    def __init__(self, model: YOLO, cfg: TrackerConfig, fps_real: float) -> None:
        self.model = model
        self.cfg = cfg
        self.tracker = sv.ByteTrack(
            track_activation_threshold=cfg.track_activation_threshold,
            lost_track_buffer=cfg.lost_track_buffer(),
            minimum_matching_threshold=cfg.minimum_matching_threshold,
            frame_rate=fps_real,
            minimum_consecutive_frames=cfg.minimum_consecutive_frames(fps_real),
        )

    def update(self, frame: np.ndarray) -> sv.Detections:
        result = self.model(frame, verbose=False, classes=[PERSON_CLASS_ID], conf=self.cfg.det_conf_threshold)[0]
        detections = sv.Detections.from_ultralytics(result)
        return self.tracker.update_with_detections(detections)

    def reset(self) -> None:
        self.tracker.reset()


class BotSortReidAdapter:
    """Backend com Re-ID de aparência: usa o tracking nativo da
    ultralytics (model.track), que já embute BoT-SORT + um extrator de
    aparência quando with_reid=True. Reassocia a mesma pessoa depois de
    oclusões mais longas, não só por posição/velocidade previstas."""

    def __init__(self, model: YOLO, cfg: TrackerConfig) -> None:
        self.model = model
        self.cfg = cfg
        self.yaml_path = self._gerar_yaml(cfg)

    @staticmethod
    def _gerar_yaml(cfg: TrackerConfig) -> Path:
        dados = {
            "tracker_type": "botsort",
            "track_high_thresh": 0.25,
            "track_low_thresh": 0.1,
            "new_track_thresh": 0.25,
            "track_buffer": cfg.botsort_track_buffer,
            "match_thresh": cfg.botsort_match_thresh,
            "fuse_score": True,
            "gmc_method": "sparseOptFlow",
            "proximity_thresh": 0.5,
            "appearance_thresh": 0.8,
            "with_reid": cfg.botsort_with_reid,
            "model": "auto",
        }
        _BOTSORT_YAML_GERADO.write_text(yaml.safe_dump(dados), encoding="utf-8")
        return _BOTSORT_YAML_GERADO

    def update(self, frame: np.ndarray) -> sv.Detections:
        result = self.model.track(
            frame,
            persist=True,
            tracker=str(self.yaml_path),
            classes=[PERSON_CLASS_ID],
            conf=self.cfg.det_conf_threshold,
            verbose=False,
        )[0]
        return sv.Detections.from_ultralytics(result)

    def reset(self) -> None:
        # ultralytics guarda o estado do tracker no próprio model; recriar
        # o predictor de tracking é o jeito documentado de "zerar" os IDs.
        if hasattr(self.model, "predictor") and self.model.predictor is not None:
            trackers = getattr(self.model.predictor, "trackers", None)
            if trackers:
                for t in trackers:
                    if hasattr(t, "reset"):
                        t.reset()


def criar_tracker(model: YOLO, cfg: TrackerConfig, fps_real: float) -> TrackerAdapter:
    if cfg.tracker_tipo == "botsort_reid":
        return BotSortReidAdapter(model, cfg)
    return ByteTrackAdapter(model, cfg, fps_real)


def abrir_fonte(source: str) -> cv2.VideoCapture:
    cam_index = int(source) if str(source).lstrip("-").isdigit() else None
    cap = cv2.VideoCapture(cam_index if cam_index is not None else source)
    if not cap.isOpened():
        raise RuntimeError(f"Não consegui abrir a fonte de vídeo: {source}")
    return cap


def fps_real_da_fonte(cap: cv2.VideoCapture, fallback: float = 30.0) -> float:
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 1 or fps > 240:
        return fallback
    return float(fps)
