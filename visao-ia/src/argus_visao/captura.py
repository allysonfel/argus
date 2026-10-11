"""Captura de vídeo: uma thread por câmera, guardando só o quadro mais
recente (quem consome nunca fica pra trás acumulando fila).

A mesma classe aceita arquivo, webcam ou RTSP:
  - RTSP: forçado via TCP, com reconexão automática (backoff até 30 s).
  - Arquivo: lido no ritmo ORIGINAL do vídeo (como se fosse câmera ao
    vivo) e reiniciado ao chegar no fim; cada volta incrementa `ciclo`.
  - Webcam: índice numérico ("0").

Cada quadro recebe um timestamp de parede (time.time()) no momento da
captura. É esse relógio único que sincroniza vídeo exibido e metadados
da análise no painel.
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass

import cv2
import numpy as np

# RTSP via TCP (UDP perde pacote fácil em rede de shopping/VPN) e timeout
# de leitura de 5 s pra detectar câmera caída rápido.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|stimeout;5000000")


@dataclass
class Quadro:
    imagem: np.ndarray
    ts: float  # time.time() da captura
    seq: int  # contador crescente
    ciclo: int  # volta do vídeo (arquivos); sempre 0 em câmera real


class FonteVideo:
    def __init__(self, fonte: str, eh_arquivo: bool) -> None:
        self.fonte = fonte
        self.eh_arquivo = eh_arquivo
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self._quadro: Quadro | None = None
        self._seq = 0
        self._ciclo = 0
        self._rodando = False
        self._thread: threading.Thread | None = None

        self.online = False
        self.erro: str | None = None
        self.fps_fonte = 0.0
        self.largura = 0
        self.altura = 0
        self._fps_medido = 0.0
        self._t_ultimo: float | None = None

    # ---------- ciclo de vida ----------

    def iniciar(self) -> None:
        self._rodando = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"captura:{self.fonte}")
        self._thread.start()

    def parar(self) -> None:
        self._rodando = False
        with self._cond:
            self._cond.notify_all()
        if self._thread is not None:
            self._thread.join(timeout=3)

    # ---------- leitura (thread-safe) ----------

    def ultimo(self) -> Quadro | None:
        with self._lock:
            return self._quadro

    def esperar_novo(self, seq_atual: int, timeout: float = 1.0) -> Quadro | None:
        """Bloqueia até chegar um quadro com seq > seq_atual (ou timeout)."""
        with self._cond:
            self._cond.wait_for(lambda: not self._rodando or (self._quadro is not None and self._quadro.seq > seq_atual), timeout=timeout)
            q = self._quadro
            return q if q is not None and q.seq > seq_atual else None

    @property
    def fps_medido(self) -> float:
        return round(self._fps_medido, 1)

    @property
    def ultimo_ts(self) -> float | None:
        q = self.ultimo()
        return q.ts if q else None

    # ---------- loop ----------

    def _abrir(self) -> cv2.VideoCapture:
        alvo: str | int = int(self.fonte) if self.fonte.isdigit() else self.fonte
        cap = cv2.VideoCapture(alvo, cv2.CAP_FFMPEG) if isinstance(alvo, str) else cv2.VideoCapture(alvo)
        if not cap.isOpened():
            raise RuntimeError(f"não foi possível abrir a fonte de vídeo: {self._fonte_segura()}")
        fps = cap.get(cv2.CAP_PROP_FPS)
        self.fps_fonte = float(fps) if fps and 1 <= fps <= 120 else 25.0
        self.largura = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.altura = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        return cap

    def _fonte_segura(self) -> str:
        """Fonte sem a senha do RTSP (pra log e painel)."""
        if "://" in self.fonte and "@" in self.fonte:
            esquema, resto = self.fonte.split("://", 1)
            return f"{esquema}://***@{resto.split('@', 1)[1]}"
        return self.fonte

    def _publicar(self, imagem: np.ndarray) -> None:
        agora = time.time()
        if self._t_ultimo is not None:
            dt = agora - self._t_ultimo
            if dt > 0:
                inst = 1.0 / dt
                self._fps_medido = inst if self._fps_medido == 0 else 0.9 * self._fps_medido + 0.1 * inst
        self._t_ultimo = agora
        with self._cond:
            self._seq += 1
            self._quadro = Quadro(imagem=imagem, ts=agora, seq=self._seq, ciclo=self._ciclo)
            self._cond.notify_all()

    def _loop(self) -> None:
        espera_reconexao = 1.0
        while self._rodando:
            try:
                cap = self._abrir()
            except RuntimeError as e:
                self.online = False
                self.erro = str(e)
                time.sleep(espera_reconexao)
                espera_reconexao = min(30.0, espera_reconexao * 2)
                continue

            self.online = True
            self.erro = None
            espera_reconexao = 1.0
            intervalo = 1.0 / self.fps_fonte
            proximo = time.monotonic()

            while self._rodando:
                ok, imagem = cap.read()
                if not ok:
                    if self.eh_arquivo:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        self._ciclo += 1
                        continue
                    self.online = False
                    self.erro = "sem quadros (conexão perdida), reconectando"
                    break

                if self.eh_arquivo:
                    # Arquivo: segura no ritmo original pra simular câmera ao vivo.
                    proximo += intervalo
                    atraso = proximo - time.monotonic()
                    if atraso > 0:
                        time.sleep(atraso)
                    elif atraso < -1.0:
                        proximo = time.monotonic()  # ficou muito pra trás: realinha

                self._publicar(imagem)

            cap.release()
        self.online = False
