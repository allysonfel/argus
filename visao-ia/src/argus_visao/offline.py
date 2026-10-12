"""Processamento OFFLINE de um vídeo (sem esperar o tempo real), usado
pelo diagnóstico e pelo script de avaliação.

Simula exatamente o que o motor faz ao vivo: pega quadros no ritmo de
`fps_analise` (pelo tempo do vídeo, não do relógio), detecta, rastreia
e aplica as mesmas regras de contagem (`RegrasCamera`).

Detecção é a parte cara e não depende dos parâmetros do tracker, então
fica em cache: na grade de parâmetros o vídeo é detectado UMA vez (com
confiança mínima baixa) e cada combinação só refiltra pela confiança.
"""

from __future__ import annotations

import hashlib
import pickle
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import supervision as sv

from .config import RAIZ, CameraConfig, Linha, MotorConfig, TrackerConfig
from .inferencia import DetectorPessoas
from .regras import RegrasCamera

CACHE_DIR = RAIZ / ".cache_deteccoes"
CONF_MINIMA_CACHE = 0.2


@dataclass
class QuadroDetectado:
    indice: int
    ts: float  # segundos desde o início do vídeo
    deteccoes: sv.Detections


def _amostrar(video: Path, fps_analise: float):
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"não abriu: {video}")
    fps_video = cap.get(cv2.CAP_PROP_FPS) or 25.0
    passo = fps_video / fps_analise
    proximo = 0.0
    indice = 0
    while True:
        ok, quadro = cap.read()
        if not ok:
            break
        if indice >= proximo:
            proximo += passo
            yield indice, indice / fps_video, quadro
        indice += 1
    cap.release()


def detectar_video(video: Path, fps_analise: float, detector: DetectorPessoas | None = None, motor: MotorConfig | None = None) -> tuple[list[QuadroDetectado], tuple[int, int]]:
    motor = motor or MotorConfig.carregar()
    # "v2": as detecções passaram a levar a aparência (data["aparencia"]).
    chave = hashlib.sha1(f"v2|{video.resolve()}|{video.stat().st_size}|{video.stat().st_mtime}|{fps_analise}|{motor.modelo}".encode()).hexdigest()[:16]
    cache = CACHE_DIR / f"{video.stem}-{chave}.pkl"
    if cache.exists():
        return pickle.loads(cache.read_bytes())

    detector = detector or DetectorPessoas(motor)
    quadros: list[QuadroDetectado] = []
    tamanho = (0, 0)
    for indice, ts, imagem in _amostrar(video, fps_analise):
        tamanho = (imagem.shape[1], imagem.shape[0])
        quadros.append(QuadroDetectado(indice, ts, detector.detectar(imagem, CONF_MINIMA_CACHE)))
        if len(quadros) % 50 == 0:
            print(f"  detectando {video.name}: {ts:.0f}s")
    resultado = (quadros, tamanho)
    CACHE_DIR.mkdir(exist_ok=True)
    cache.write_bytes(pickle.dumps(resultado))
    return resultado


def rodar(quadros: list[QuadroDetectado], tamanho: tuple[int, int], cfg: TrackerConfig, fps_analise: float, linhas: list[Linha] | None = None, ao_rastrear=None, video: Path | None = None, extrator=None) -> dict:
    """Roda tracking + regras sobre detecções já prontas. `ao_rastrear`
    (opcional) recebe (QuadroDetectado, rastreadas) a cada quadro. Com
    `video` + `extrator` (reid.ExtratorReid), relê os quadros e liga o Re-ID."""
    camera = CameraConfig(id="offline", nome="offline", fonte="", fps_analise=fps_analise, linhas=linhas or [])
    regras = RegrasCamera(camera, cfg, fps_analise, extrator=extrator)
    imagens = _quadros_por_indice(video, {q.indice for q in quadros}) if video is not None and extrator is not None else None
    for q in quadros:
        dets = q.deteccoes[q.deteccoes.confidence >= cfg.det_conf_threshold] if len(q.deteccoes) else q.deteccoes
        imagem = next(imagens) if imagens is not None else None
        rastreadas = regras.atualizar(dets, q.ts, *tamanho, imagem=imagem)
        if ao_rastrear:
            ao_rastrear(q, rastreadas)

    duracoes = sorted(list(regras.duracoes_encerradas) + list(regras.duracoes_ativas().values()))
    stats = regras.estatisticas()
    return {
        "visitantes_unicos_estimado": stats["visitantes_unicos_estimado"],
        "ids_criados": stats["ids_criados"],
        "linhas": stats["linhas"],
        "duracoes_s": [round(d, 2) for d in duracoes],
    }


def _quadros_por_indice(video: Path, indices: set[int]):
    """Gera, em ordem, as imagens dos quadros pedidos (mesmos índices de _amostrar)."""
    cap = cv2.VideoCapture(str(video))
    i = 0
    while True:
        ok, quadro = cap.read()
        if not ok:
            break
        if i in indices:
            yield quadro
        i += 1
    cap.release()


def histograma_duracoes(duracoes: list[float]) -> dict[str, int]:
    faixas = [(0, 0.5, "< 0,5 s"), (0.5, 1, "0,5-1 s"), (1, 2, "1-2 s"), (2, 5, "2-5 s"), (5, 10, "5-10 s"), (10, np.inf, "> 10 s")]
    return {rotulo: sum(1 for d in duracoes if lo <= d < hi) for lo, hi, rotulo in faixas}
