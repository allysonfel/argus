"""Painel próprio do módulo de Visão (rastreio de pessoas + gênero/idade),
separado do sistema principal do Argus. Roda local, servido por FastAPI.

Uso:
    uv run uvicorn app:app --port 8500 --reload
Depois abra: http://localhost:8500
"""

from __future__ import annotations

import time
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from rastreio import Rastreador

BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Argus Visão")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

rastreador = Rastreador()


@app.get("/", response_class=HTMLResponse)
def painel() -> str:
    return (BASE_DIR / "static" / "index.html").read_text(encoding="utf-8")


@app.get("/api/stats")
def stats() -> JSONResponse:
    return JSONResponse(rastreador.estatisticas())


@app.post("/api/fonte/webcam")
def usar_webcam(indice: int = 0) -> JSONResponse:
    rastreador.iniciar(indice)
    return JSONResponse({"ok": True})


@app.post("/api/fonte/upload")
async def enviar_video(arquivo: UploadFile = File(...)) -> JSONResponse:
    destino = UPLOADS_DIR / arquivo.filename
    conteudo = await arquivo.read()
    destino.write_bytes(conteudo)
    rastreador.iniciar(str(destino))
    return JSONResponse({"ok": True, "arquivo": arquivo.filename})


@app.post("/api/parar")
def parar() -> JSONResponse:
    rastreador.parar()
    return JSONResponse({"ok": True})


@app.post("/api/reset")
def resetar() -> JSONResponse:
    rastreador.resetar()
    return JSONResponse({"ok": True})


def _gerar_stream():
    frame_vazio_enviado = False
    while True:
        frame = rastreador.frame_jpeg()
        if frame is None:
            if not frame_vazio_enviado:
                frame_vazio_enviado = True
            time.sleep(0.2)
            continue
        frame_vazio_enviado = False
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
        time.sleep(0.03)


@app.get("/video_feed")
def video_feed() -> StreamingResponse:
    return StreamingResponse(_gerar_stream(), media_type="multipart/x-mixed-replace; boundary=frame")
