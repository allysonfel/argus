"""Baixa e prepara os vídeos das CÂMERAS DE DEMONSTRAÇÃO (enquanto não
temos as câmeras reais do Shopping Caruaru).

Fontes reais de shopping, com licença que permite uso comercial:
- Pexels (licença Pexels: uso livre, inclusive comercial, sem atribuição);
- CAVIAR (CCTV de um shopping em Lisboa, Creative Commons BY-SA; citar o
  projeto EC CAVIAR IST 2001 37540 em material publicado). As duas
  câmeras WalkByShop1 são sincronizadas: mesma cena, dois ângulos.

Cada vídeo é reduzido pra no máximo 960 px de largura e 30 fps (o motor e a prévia
não usam mais que isso, e decodificar 4K em CPU custa caro) e, quando a
filmagem tem deriva de câmera, estabilizado contra o primeiro quadro, pra
linhas e zonas ficarem paradas sobre o piso como numa câmera fixa.

Uso (de dentro de visao-ia/):
    uv run preparar_demo.py            # baixa o que falta e prepara tudo
    uv run preparar_demo.py --refazer  # prepara de novo mesmo se já existe

Saída em uploads/demo/ (fora do git), referenciada em config/cameras.json.
"""

from __future__ import annotations

import argparse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parent
ORIGINAIS = RAIZ / "uploads" / "demo" / "originais"
SAIDA = RAIZ / "uploads" / "demo"

LARGURA_MAX = 960
# Acima disso só custa CPU na captura (a prévia vai a no máx. 25 fps).
FPS_MAX = 30
CAVIAR = "https://homepages.inf.ed.ac.uk/rbf/CAVIARDATA2"


@dataclass
class VideoDemo:
    nome: str
    url: str
    estabilizar: bool = False
    # Fração da borda cortada depois de estabilizar (esconde a borda preta).
    margem: float = 0.04
    # Região do quadro original (x0, y0, x1, y1 em 0-1), ex.: faixa 16:9 de
    # um vídeo vertical gravado em celular.
    recorte: tuple[float, float, float, float] | None = None


VIDEOS = [
    VideoDemo("praca-central", "https://www.pexels.com/download/video/3660928/", estabilizar=True, margem=0.05),
    VideoDemo("corredor-lojas", "https://www.pexels.com/download/video/34892172/", estabilizar=True, margem=0.02),
    VideoDemo("corredor-gastronomico", "https://www.pexels.com/download/video/39687034/"),
    VideoDemo("caviar-corredor", f"{CAVIAR}/WalkByShop1cor/WalkByShop1cor.mpg"),
    VideoDemo("caviar-fachada", f"{CAVIAR}/WalkByShop1front/WalkByShop1front.mpg"),
    VideoDemo("praca-alimentacao", "https://www.pexels.com/download/video/36694215/"),
    VideoDemo("area-eventos", "https://www.pexels.com/download/video/34697769/"),
    VideoDemo("escadas-rolantes", "https://www.pexels.com/download/video/1338592/", estabilizar=True, margem=0.02),
    VideoDemo("fast-food", "https://www.pexels.com/download/video/1338597/", estabilizar=True, margem=0.02),
    VideoDemo("atrio-decorado", "https://www.pexels.com/download/video/15007112/", estabilizar=True, margem=0.04),
    VideoDemo("hiper-caixas", "https://www.pexels.com/download/video/39221979/", estabilizar=True, margem=0.06),
    VideoDemo("hiper-autoatendimento", "https://www.pexels.com/download/video/36635591/", estabilizar=True, margem=0.06),
    VideoDemo("quiosques", "https://www.pexels.com/download/video/28925811/", estabilizar=True, margem=0.02),
    VideoDemo("atrio-aereo", "https://www.pexels.com/download/video/39527934/", estabilizar=True, margem=0.1),
    VideoDemo("mezanino", "https://www.pexels.com/download/video/36108267/", estabilizar=True, margem=0.04, recorte=(0.0, 0.1, 1.0, 0.416)),
]


def baixar(v: VideoDemo) -> Path:
    ORIGINAIS.mkdir(parents=True, exist_ok=True)
    destino = ORIGINAIS / f"{v.nome}{Path(v.url.rstrip('/')).suffix or '.mp4'}"
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    print(f"[baixar] {v.nome} <- {v.url}")
    req = urllib.request.Request(v.url, headers={"User-Agent": "Mozilla/5.0 (argus-demo)"})
    with urllib.request.urlopen(req, timeout=300) as resp, open(destino, "wb") as f:
        while bloco := resp.read(1 << 20):
            f.write(bloco)
    return destino


class Estabilizador:
    """Alinha cada quadro ao primeiro (afim parcial: translação, rotação e
    escala) por pontos ORB do fundo; RANSAC descarta as pessoas andando."""

    def __init__(self, referencia: np.ndarray) -> None:
        self._orb = cv2.ORB_create(3000)
        self._casador = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        self._kp_ref, self._desc_ref = self._orb.detectAndCompute(cv2.cvtColor(referencia, cv2.COLOR_BGR2GRAY), None)
        self._ultima = np.eye(2, 3, dtype=np.float32)

    def alinhar(self, quadro: np.ndarray) -> np.ndarray:
        kp, desc = self._orb.detectAndCompute(cv2.cvtColor(quadro, cv2.COLOR_BGR2GRAY), None)
        if desc is not None and len(kp) >= 10:
            pares = self._casador.match(desc, self._desc_ref)
            if len(pares) >= 10:
                origem = np.float32([kp[p.queryIdx].pt for p in pares])
                alvo = np.float32([self._kp_ref[p.trainIdx].pt for p in pares])
                m, _ = cv2.estimateAffinePartial2D(origem, alvo, method=cv2.RANSAC, ransacReprojThreshold=2.0)
                if m is not None:
                    self._ultima = m.astype(np.float32)
        altura, largura = quadro.shape[:2]
        return cv2.warpAffine(quadro, self._ultima, (largura, altura), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def preparar(v: VideoDemo, original: Path, refazer: bool) -> Path:
    destino = SAIDA / f"{v.nome}.mp4"
    if destino.exists() and not refazer:
        print(f"[preparar] {v.nome}: já existe")
        return destino

    cap = cv2.VideoCapture(str(original))
    if not cap.isOpened():
        raise RuntimeError(f"não abriu: {original}")
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 25.0
    passo = max(1, round(fps_in / FPS_MAX))
    fps = fps_in / passo
    largura_in = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    altura_in = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if v.recorte:
        x0, y0, x1, y1 = (round(f * t) for f, t in zip(v.recorte, (largura_in, altura_in, largura_in, altura_in)))
        largura_in, altura_in = x1 - x0, y1 - y0
    escala = min(1.0, LARGURA_MAX / largura_in)
    largura, altura = round(largura_in * escala / 2) * 2, round(altura_in * escala / 2) * 2

    escritor = cv2.VideoWriter(str(destino), cv2.VideoWriter_fourcc(*"mp4v"), fps, (largura, altura))
    estab: Estabilizador | None = None
    n = 0
    lidos = 0
    while True:
        ok, quadro = cap.read()
        if not ok:
            break
        lidos += 1
        if (lidos - 1) % passo:
            continue
        if v.recorte:
            quadro = quadro[y0:y1, x0:x1]
        if escala < 1.0 or v.recorte:
            quadro = cv2.resize(quadro, (largura, altura), interpolation=cv2.INTER_AREA)
        if v.estabilizar:
            if estab is None:
                estab = Estabilizador(quadro)
            quadro = estab.alinhar(quadro)
            mx, my = round(largura * v.margem), round(altura * v.margem)
            quadro = cv2.resize(quadro[my : altura - my, mx : largura - mx], (largura, altura), interpolation=cv2.INTER_LINEAR)
        escritor.write(quadro)
        n += 1
    cap.release()
    escritor.release()
    print(f"[preparar] {v.nome}: {n} quadros, {largura}x{altura} @ {fps:.0f} fps ({n / fps:.0f} s){' estabilizado' if v.estabilizar else ''}")
    return destino


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--refazer", action="store_true", help="prepara de novo mesmo se o vídeo de saída já existe")
    args = p.parse_args()
    SAIDA.mkdir(parents=True, exist_ok=True)
    for v in VIDEOS:
        preparar(v, baixar(v), args.refazer)


if __name__ == "__main__":
    main()
