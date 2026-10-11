"""API do motor de visão (FastAPI). O painel fica no app Next.js do
Argus; aqui só existe API + WebSocket.

Uso (de dentro de visao-ia/):
    uv run uvicorn argus_visao.api:app --port 8500

Endpoints:
    GET  /api/saude                     motor no ar + dispositivo/modelo
    GET  /api/cameras                   status de todas as câmeras
    GET  /api/cameras/{id}              status + estatísticas de uma câmera
    POST /api/cameras/{id}/zerar        zera as contagens da câmera
    WS   /ws/cameras/{id}               ao vivo: quadros + metadados

Protocolo do WebSocket (servidor -> painel):
    - mensagem BINÁRIA: 8 bytes (float64 little-endian, timestamp da
      captura) + JPEG do quadro ORIGINAL, sem desenho, no ritmo da fonte.
    - mensagem TEXTO: JSON {"tipo": "meta", "ts", "tracks", "stats",
      "debug"}, no ritmo da análise. O painel casa os dois pelo `ts`.
"""

from __future__ import annotations

import asyncio
import os
import struct
from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .analisador import AnalisadorCamera
from .config import MotorConfig, carregar_cameras
from .inferencia import DetectorPessoas

# Teto de quadros/s enviados pra exibição (vídeo de 60 fps não precisa ir inteiro).
PREVIA_FPS_MAX = 25.0

motor_cfg = MotorConfig.carregar()
analisadores: dict[str, AnalisadorCamera] = {}
detector: DetectorPessoas | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global detector
    detector = DetectorPessoas(motor_cfg)
    for cam in carregar_cameras():
        if not cam.ativa:
            continue
        a = AnalisadorCamera(cam, detector)
        a.iniciar()
        analisadores[cam.id] = a
        print(f"[api] câmera '{cam.id}' iniciada ({cam.fps_analise} fps de análise)")
    yield
    for a in analisadores.values():
        a.parar()


app = FastAPI(title="Argus Visão", lifespan=lifespan)

origens = os.environ.get("ARGUS_PAINEL_ORIGENS", "http://localhost:3000,http://localhost:3002").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origens, allow_methods=["*"], allow_headers=["*"])


def _analisador(camera_id: str) -> AnalisadorCamera:
    a = analisadores.get(camera_id)
    if a is None:
        raise HTTPException(status_code=404, detail="câmera não encontrada")
    return a


@app.get("/api/saude")
def saude() -> dict:
    return {
        "ok": True,
        "modelo": motor_cfg.modelo,
        "dispositivo": detector.dispositivo if detector else None,
        "cameras": len(analisadores),
    }


@app.get("/api/cameras")
def listar_cameras() -> list[dict]:
    return [a.status() for a in analisadores.values()]


@app.get("/api/cameras/{camera_id}")
def status_camera(camera_id: str) -> dict:
    return _analisador(camera_id).status()


@app.post("/api/cameras/{camera_id}/zerar")
def zerar_camera(camera_id: str) -> dict:
    _analisador(camera_id).zerar()
    return {"ok": True}


def _codificar_previa(imagem, ts: float) -> bytes | None:
    altura, largura = imagem.shape[:2]
    if largura > motor_cfg.previa_largura_max:
        escala = motor_cfg.previa_largura_max / largura
        imagem = cv2.resize(imagem, (motor_cfg.previa_largura_max, round(altura * escala)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", imagem, [cv2.IMWRITE_JPEG_QUALITY, motor_cfg.previa_qualidade_jpeg])
    return struct.pack("<d", ts) + buf.tobytes() if ok else None


async def _enviar_quadros(ws: WebSocket, a: AnalisadorCamera) -> None:
    seq = 0
    ultimo_envio = 0.0
    while True:
        quadro = await asyncio.to_thread(a.fonte.esperar_novo, seq, 1.0)
        if quadro is None:
            continue
        seq = quadro.seq
        if quadro.ts - ultimo_envio < 1.0 / PREVIA_FPS_MAX:
            continue
        ultimo_envio = quadro.ts
        dados = await asyncio.to_thread(_codificar_previa, quadro.imagem, quadro.ts)
        if dados:
            await ws.send_bytes(dados)


async def _enviar_metadados(ws: WebSocket, fila: asyncio.Queue) -> None:
    while True:
        await ws.send_json(await fila.get())


def _registrar_falha(tarefa: asyncio.Task) -> None:
    if not tarefa.cancelled() and tarefa.exception() and not isinstance(tarefa.exception(), (WebSocketDisconnect, RuntimeError)):
        print(f"[api] envio ao painel falhou: {tarefa.exception()!r}")


@app.websocket("/ws/cameras/{camera_id}")
async def ao_vivo(ws: WebSocket, camera_id: str) -> None:
    a = analisadores.get(camera_id)
    if a is None:
        await ws.close(code=4404)
        return
    await ws.accept()
    fila = a.assinantes.assinar()
    tarefas = [asyncio.create_task(_enviar_quadros(ws, a)), asyncio.create_task(_enviar_metadados(ws, fila))]
    for t in tarefas:
        t.add_done_callback(_registrar_falha)
    try:
        # Só pra perceber a desconexão do cliente.
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        a.assinantes.cancelar(fila)
        for t in tarefas:
            t.cancel()
