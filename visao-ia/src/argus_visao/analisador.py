"""Análise contínua de uma câmera, em thread própria, no SEU ritmo
(`fps_analise`, padrão 4), independente da velocidade do vídeo.

A cada análise publica METADADOS (caixas normalizadas 0-1 + tracker_id
+ timestamp da captura do quadro analisado). O painel desenha isso
num <canvas> sobre o vídeo, interpolando as caixas entre análises, então
o vídeo nunca espera a IA.
"""

from __future__ import annotations

import asyncio
import threading
import time

from .captura import FonteVideo
from .config import CameraConfig, TrackerConfig
from .inferencia import DetectorPessoas
from .regras import RegrasCamera


class Assinantes:
    """Fila de metadados pra cada WebSocket conectado. Publicação vem
    da thread de análise; o consumo é no loop asyncio do FastAPI."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._filas: set[tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = set()

    def assinar(self) -> asyncio.Queue:
        fila: asyncio.Queue = asyncio.Queue(maxsize=50)
        with self._lock:
            self._filas.add((asyncio.get_running_loop(), fila))
        return fila

    def cancelar(self, fila: asyncio.Queue) -> None:
        with self._lock:
            self._filas = {(l, f) for l, f in self._filas if f is not fila}

    def __len__(self) -> int:
        with self._lock:
            return len(self._filas)

    def publicar(self, msg: dict) -> None:
        with self._lock:
            alvos = list(self._filas)
        for loop, fila in alvos:
            loop.call_soon_threadsafe(_colocar_sem_bloquear, fila, msg)


def _colocar_sem_bloquear(fila: asyncio.Queue, msg: dict) -> None:
    if fila.full():  # cliente lento: descarta o mais antigo, nunca trava a análise
        fila.get_nowait()
    fila.put_nowait(msg)


class AnalisadorCamera:
    def __init__(self, camera: CameraConfig, detector: DetectorPessoas, fps_sem_espectador: float | None = None, extrator_reid=None) -> None:
        self.camera = camera
        self.detector = detector
        self.fps_sem_espectador = fps_sem_espectador
        self.cfg = TrackerConfig.carregar(camera.preset)
        self.fonte = FonteVideo(camera.resolver_fonte(), camera.eh_arquivo)
        self.regras = RegrasCamera(camera, self.cfg, camera.fps_analise, extrator=extrator_reid)
        self.assinantes = Assinantes()
        self._lock = threading.Lock()
        self._rodando = False
        self._thread: threading.Thread | None = None
        self._ultima_msg: dict | None = None

        self.fps_analise_real = 0.0
        self.inferencia_ms = 0.0
        self.ultima_analise_ts: float | None = None

    def iniciar(self) -> None:
        self.fonte.iniciar()
        self._rodando = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"analise:{self.camera.id}")
        self._thread.start()

    def parar(self) -> None:
        self._rodando = False
        self.fonte.parar()
        if self._thread is not None:
            self._thread.join(timeout=3)

    def zerar(self) -> None:
        with self._lock:
            self.regras.zerar()

    def _loop(self) -> None:
        seq = 0
        ciclo = 0
        t_anterior: float | None = None
        proximo = time.monotonic()

        while self._rodando:
            quadro = self.fonte.esperar_novo(seq, timeout=1.0)
            if quadro is None:
                continue
            seq = quadro.seq

            if quadro.ciclo != ciclo:
                ciclo = quadro.ciclo
                # Nova volta do vídeo de teste: tracks antigos não podem
                # "continuar" no começo do vídeo (inflaria a contagem).
                with self._lock:
                    if self.camera.zerar_ao_reiniciar_video:
                        self.regras.zerar()
                    else:
                        self.regras.reiniciar_tracker()

            altura, largura = quadro.imagem.shape[:2]
            t0 = time.perf_counter()
            # Com alguém assistindo, a câmera fura a fila do detector compartilhado
            # e ganha Re-ID (caro em CPU, então só onde alguém está olhando).
            assistida = len(self.assinantes) > 0
            deteccoes = self.detector.detectar(quadro.imagem, self.cfg.det_conf_threshold, prioritario=assistida)
            self.inferencia_ms = (time.perf_counter() - t0) * 1000
            with self._lock:
                rastreadas = self.regras.atualizar(deteccoes, quadro.ts, largura, altura, imagem=quadro.imagem if assistida else None)
                stats = self.regras.estatisticas()
                # Caminho de cada pessoa só vai pra quem está assistindo.
                caminhos = self.regras.caminhos(rastreadas.tracker_id.tolist()) if len(self.assinantes) else {}

            agora = time.time()
            if t_anterior is not None:
                inst = 1.0 / max(1e-6, agora - t_anterior)
                self.fps_analise_real = inst if self.fps_analise_real == 0 else 0.8 * self.fps_analise_real + 0.2 * inst
            t_anterior = agora
            self.ultima_analise_ts = agora

            tracks = []
            confs = rastreadas.confidence if rastreadas.confidence is not None else [None] * len(rastreadas)
            for (x1, y1, x2, y2), tid, conf in zip(rastreadas.xyxy, rastreadas.tracker_id, confs):
                tracks.append(
                    {
                        "id": int(tid),
                        "b": [round(float(x1) / largura, 4), round(float(y1) / altura, 4), round(float(x2) / largura, 4), round(float(y2) / altura, 4)],
                        "c": round(float(conf), 2) if conf is not None else None,
                        # Caminho (pés, 0-1) desde que a pessoa entrou na imagem.
                        "p": caminhos.get(int(tid), []),
                    }
                )

            msg = {
                "tipo": "meta",
                "camera": self.camera.id,
                "ts": quadro.ts,
                "seq": quadro.seq,
                "tracks": tracks,
                "stats": stats,
                "debug": {
                    "fps_analise": round(self.fps_analise_real, 1),
                    "fps_analise_alvo": self.fps_alvo,
                    "inferencia_ms": round(self.inferencia_ms),
                    "latencia_ms": round((agora - quadro.ts) * 1000),
                    "dispositivo": self.detector.dispositivo,
                    "duracoes": self.regras.duracoes_ativas(),
                },
            }
            self._ultima_msg = msg
            self.assinantes.publicar(msg)

            # Segura no ritmo de análise configurado (sem acumular atraso).
            proximo += 1.0 / self.fps_alvo
            espera = proximo - time.monotonic()
            if espera > 0:
                time.sleep(espera)
            else:
                proximo = time.monotonic()

    @property
    def fps_alvo(self) -> float:
        """fps de análise cheio com alguém assistindo no painel; senão,
        limitado por `fps_analise_sem_espectador` (motor.json)."""
        if self.fps_sem_espectador and len(self.assinantes) == 0:
            return min(self.camera.fps_analise, self.fps_sem_espectador)
        return self.camera.fps_analise

    def status(self) -> dict:
        ultimo_ts = self.fonte.ultimo_ts
        sem_quadros_s = round(time.time() - ultimo_ts, 1) if ultimo_ts else None
        with self._lock:
            stats = self.regras.estatisticas()
        return {
            "id": self.camera.id,
            "nome": self.camera.nome,
            "andar": self.camera.andar,
            "corredor": self.camera.corredor,
            "area_negocio": self.camera.area_negocio,
            "credito": self.camera.credito,
            "online": self.fonte.online,
            "erro": self.fonte.erro,
            "fonte": self.fonte._fonte_segura(),
            "tipo_fonte": "arquivo" if self.camera.eh_arquivo else ("webcam" if self.camera.fonte.isdigit() else "rtsp"),
            "fps_fonte": round(self.fonte.fps_fonte, 1),
            "fps_captura": self.fonte.fps_medido,
            "fps_analise": round(self.fps_analise_real, 1),
            "fps_analise_alvo": self.fps_alvo,
            "inferencia_ms": round(self.inferencia_ms),
            "sem_quadros_ha_s": sem_quadros_s,
            "resolucao": [self.fonte.largura, self.fonte.altura],
            "linhas": [{"id": l.id, "nome": l.nome, "inicio": l.inicio, "fim": l.fim} for l in self.camera.linhas],
            "zonas": [{"id": z.id, "nome": z.nome, "poligono": z.poligono} for z in self.camera.zonas],
            "preset": self.cfg.nome,
            "stats": stats,
        }
