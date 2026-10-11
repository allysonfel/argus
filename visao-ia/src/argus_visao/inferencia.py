"""Detecção de pessoas, roda 100% local (sem API paga, sem tokens).

Modelo padrão: RF-DETR (Apache 2.0, Roboflow), trocável por
configuração (`config/motor.json` -> "modelo"). Dispositivo escolhido
automaticamente: CUDA (servidor com GPU) > MPS (Mac M1/M2) > CPU. O
mesmo código serve pros três, só muda a configuração.
"""

from __future__ import annotations

import os
import threading

# Operações que o Metal ainda não implementa caem pra CPU em vez de dar erro.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import cv2
import numpy as np
import supervision as sv
import torch

from .config import MotorConfig

# No RF-DETR (rótulos COCO originais), "person" é a classe 1.
CLASSE_PESSOA_RFDETR = 1


def escolher_dispositivo(preferencia: str = "auto") -> str:
    if preferencia != "auto":
        return preferencia
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _classe_rfdetr(nome: str):
    import rfdetr

    mapa = {
        "rfdetr-nano": rfdetr.RFDETRNano,
        "rfdetr-small": rfdetr.RFDETRSmall,
        "rfdetr-medium": rfdetr.RFDETRMedium,
        "rfdetr-base": rfdetr.RFDETRBase,
    }
    if nome not in mapa:
        raise ValueError(f"modelo desconhecido: {nome} (opções: {', '.join(mapa)})")
    return mapa[nome]


class DetectorPessoas:
    """Interface única de detecção: recebe quadro BGR (OpenCV), devolve
    sv.Detections só com pessoas (class_id = 0)."""

    def __init__(self, cfg: MotorConfig) -> None:
        self.cfg = cfg
        self.dispositivo = escolher_dispositivo(cfg.dispositivo)
        print(f"[inferencia] carregando {cfg.modelo} em {self.dispositivo}...")
        self._modelo = _classe_rfdetr(cfg.modelo)(device=self.dispositivo)
        if self.dispositivo.startswith("cuda") and cfg.fp16_em_cuda:
            try:
                self._modelo.inference(dtype=torch.float16)
            except Exception as e:  # versão do rfdetr sem esse método: segue em fp32
                print(f"[inferencia] fp16 indisponível ({e}); usando fp32")
        # Um único modelo compartilhado entre todas as câmeras do servidor:
        # a GPU/MPS processa uma inferência por vez.
        self._lock = threading.Lock()

    def detectar(self, quadro_bgr: np.ndarray, conf_minima: float) -> sv.Detections:
        rgb = cv2.cvtColor(quadro_bgr, cv2.COLOR_BGR2RGB)
        with self._lock:
            dets = self._modelo.predict(rgb, threshold=conf_minima)
        dets = dets[dets.class_id == CLASSE_PESSOA_RFDETR]
        dets.class_id = np.zeros(len(dets), dtype=int)
        return dets
