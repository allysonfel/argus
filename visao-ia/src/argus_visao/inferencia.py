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

# Aparência (pra costura de IDs): histograma H x S da região do tronco.
BINS_APARENCIA = (16, 8)


def descrever_aparencia(quadro_bgr: np.ndarray, xyxy: np.ndarray) -> np.ndarray:
    """Um histograma de cor (HSV, matiz x saturação, normalizado) por
    pessoa, só da região do tronco: o meio da caixa, onde a roupa
    domina e o fundo/chão aparece menos. Sem rosto: é cor de roupa."""
    altura, largura = quadro_bgr.shape[:2]
    saida = np.zeros((len(xyxy), BINS_APARENCIA[0] * BINS_APARENCIA[1]), dtype=np.float32)
    for i, (x1, y1, x2, y2) in enumerate(xyxy):
        w, h = x2 - x1, y2 - y1
        ax1, ax2 = int(max(0, x1 + 0.25 * w)), int(min(largura, x2 - 0.25 * w))
        ay1, ay2 = int(max(0, y1 + 0.15 * h)), int(min(altura, y1 + 0.55 * h))
        if ax2 - ax1 < 2 or ay2 - ay1 < 2:
            continue
        hsv = cv2.cvtColor(quadro_bgr[ay1:ay2, ax1:ax2], cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, list(BINS_APARENCIA), [0, 180, 0, 256]).flatten()
        total = hist.sum()
        if total > 0:
            saida[i] = hist / total
    return saida


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
        # a GPU/MPS processa uma inferência por vez. Pedidos prioritários
        # (câmera aberta no painel) passam na frente dos demais.
        self._cond = threading.Condition()
        self._ocupado = False
        self._prioritarios_esperando = 0

    def detectar(self, quadro_bgr: np.ndarray, conf_minima: float, prioritario: bool = False) -> sv.Detections:
        rgb = cv2.cvtColor(quadro_bgr, cv2.COLOR_BGR2RGB)
        with self._cond:
            if prioritario:
                self._prioritarios_esperando += 1
            try:
                self._cond.wait_for(lambda: not self._ocupado and (prioritario or self._prioritarios_esperando == 0))
            finally:
                if prioritario:
                    self._prioritarios_esperando -= 1
            self._ocupado = True
        try:
            dets = self._modelo.predict(rgb, threshold=conf_minima)
        finally:
            with self._cond:
                self._ocupado = False
                self._cond.notify_all()
        dets = dets[dets.class_id == CLASSE_PESSOA_RFDETR]
        dets.class_id = np.zeros(len(dets), dtype=int)
        dets.data["aparencia"] = descrever_aparencia(quadro_bgr, dets.xyxy)
        return dets
