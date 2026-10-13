"""Gera os CASOS REAIS de demonstração das telas de Fluxo e espaços e da
Busca de criança perdida: roda o motor inteiro (RF-DETR + OC-SORT +
costura + Re-ID) uma vez sobre cada vídeo de demonstração e guarda, por
pessoa, o trajeto, a cor da roupa, a estatura estimada e um recorte.

As telas do painel recebem esse arquivo e calculam tudo em cima dele
(mapa de calor, paradas na vitrine, rotas, zonas mortas, busca por
descrição), sincronizado com o vídeo que está tocando. Nada de dado
simulado: cada número sai do que o motor viu.

Uso (de dentro de visao-ia/, depois do preparar_demo.py):
    uv run --group casos gerar_casos.py             # gera o que falta
    uv run --group casos gerar_casos.py --refazer   # refaz tudo

Saída em casos/ (servida pelo motor em /casos):
    casos/<camera>.json    trajetos e descritores (vai pro git)
    casos/recortes/*.jpg   um recorte por pessoa (vai pro git)
    casos/videos/*.mp4     vídeo em H.264 que o navegador toca (fora do git;
                           o mp4v do preparar_demo.py não toca no navegador)
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
import supervision as sv

from argus_visao.config import CameraConfig, MotorConfig, RAIZ, TrackerConfig, carregar_cameras
from argus_visao.inferencia import DetectorPessoas
from argus_visao.regras import RegrasCamera

PASTA = RAIZ / "casos"
FPS_ANALISE = 3  # o mesmo da operação ao vivo (parâmetros calibrados nele)
FPS_VIDEO_WEB = 15
# Offline o tempo não aperta: modelo maior que o do ao vivo (nano) e
# confiança mais baixa, pra pegar quem está em grupo ou longe.
MODELO = "rfdetr-medium"
CONF = 0.3

# Câmeras analisadas. `estatura`: False nas câmeras de cima (vista aérea),
# onde a altura da caixa não diz a altura da pessoa.
CAMERAS = [
    ("demo-praca-central", False),
    ("demo-caviar-corredor", True),
    ("demo-caviar-fachada", True),
    ("demo-mezanino", True),
    ("demo-corredor-lojas", True),
    ("demo-corredor-gastronomico", True),
    ("demo-praca-alimentacao", True),
    ("demo-quiosques", True),
    ("demo-fast-food", True),
    ("demo-escadas-rolantes", True),
    ("demo-atrio-aereo", False),
    ("demo-atrio-decorado", True),
    ("demo-hiper-caixas", True),
    ("demo-hiper-autoatendimento", True),
    ("demo-area-eventos", True),
]

# ---------- cor da roupa ----------

CORES_HEX = {
    "preto": "#1f1f1f", "branco": "#f2f2f2", "cinza": "#8a8a8a", "vermelho": "#c62828", "laranja": "#ef6c00",
    "amarelo": "#f9c80e", "verde": "#2e7d32", "azul": "#1565c0", "roxo": "#6a1b9a", "rosa": "#e85d9a", "marrom": "#6d4c41",
}
NOMES_CORES = list(CORES_HEX)


def classificar_pixels(hsv: np.ndarray) -> np.ndarray:
    """Nome de cor (índice em NOMES_CORES) de cada pixel HSV do OpenCV
    (H 0-179, S e V 0-255). Regras simples e explicáveis, sem modelo."""
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    idx = np.full(h.shape, NOMES_CORES.index("cinza"))
    croma = (s >= 60) & (v >= 50)
    idx[(v < 55)] = NOMES_CORES.index("preto")
    idx[(s < 45) & (v >= 175)] = NOMES_CORES.index("branco")
    idx[(s < 60) & (v >= 55) & (v < 175)] = NOMES_CORES.index("cinza")
    faixas = [
        ("vermelho", (h < 6) | (h >= 172)),
        ("laranja", (h >= 6) & (h < 18)),
        ("amarelo", (h >= 18) & (h < 34)),
        ("verde", (h >= 34) & (h < 86)),
        ("azul", (h >= 86) & (h < 131)),
        ("roxo", (h >= 131) & (h < 148)),
        ("rosa", (h >= 148) & (h < 172)),
    ]
    for nome, m in faixas:
        idx[croma & m] = NOMES_CORES.index(nome)
    # Laranja/vermelho escuro é marrom (roupa de couro, calça cáqui escura).
    idx[croma & (h >= 4) & (h < 25) & (v < 130)] = NOMES_CORES.index("marrom")
    return idx


def histograma_roupa(imagem: np.ndarray, caixa, faixa: tuple[float, float]) -> np.ndarray | None:
    """Histograma de nomes de cor no miolo da faixa vertical da caixa
    (ex.: 0,20-0,48 = tronco). Laterais cortadas pra pegar menos fundo."""
    x1, y1, x2, y2 = caixa
    w, h = x2 - x1, y2 - y1
    ya, yb = int(y1 + faixa[0] * h), int(y1 + faixa[1] * h)
    xa, xb = int(x1 + 0.3 * w), int(x2 - 0.3 * w)
    if yb - ya < 3 or xb - xa < 2:
        return None
    hsv = cv2.cvtColor(imagem[ya:yb, xa:xb], cv2.COLOR_BGR2HSV)
    return np.bincount(classificar_pixels(hsv).ravel(), minlength=len(NOMES_CORES)).astype(float)


def cor_dominante(hist: np.ndarray | None) -> dict | None:
    if hist is None or hist.sum() == 0:
        return None
    p = hist / hist.sum()
    ordem = np.argsort(-p)
    res = {"cor": NOMES_CORES[ordem[0]], "pct": round(float(p[ordem[0]]), 2)}
    if p[ordem[1]] >= 0.25:
        res["segunda"] = NOMES_CORES[ordem[1]]
    return res


# ---------- geometria ----------


def iou_max(caixas: np.ndarray, i: int) -> float:
    if len(caixas) < 2:
        return 0.0
    a = caixas[i]
    outras = np.delete(caixas, i, axis=0)
    xa, ya = np.maximum(a[0], outras[:, 0]), np.maximum(a[1], outras[:, 1])
    xb, yb = np.minimum(a[2], outras[:, 2]), np.minimum(a[3], outras[:, 3])
    inter = np.clip(xb - xa, 0, None) * np.clip(yb - ya, 0, None)
    area = (a[2] - a[0]) * (a[3] - a[1])
    return float((inter / np.maximum(1e-6, area)).max())


def video_web(origem: Path, destino: Path) -> None:
    import imageio_ffmpeg

    destino.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y", "-i", str(origem), "-an", "-vf", f"fps={FPS_VIDEO_WEB}",
         "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destino)],
        check=True,
    )


# ---------- análise ----------


def analisar(camera: CameraConfig, estatura_confiavel: bool, detector: DetectorPessoas, extrator, refazer: bool, conf: float | None = None) -> None:
    saida = PASTA / f"{camera.id}.json"
    web = PASTA / "videos" / Path(camera.fonte).name
    if not web.exists() or refazer:
        print(f"  convertendo vídeo para o navegador: {web.name}")
        video_web(Path(camera.resolver_fonte()), web)
    if saida.exists() and not refazer:
        print(f"  {saida.name} já existe (use --refazer)")
        return

    cfg = TrackerConfig.carregar(camera.preset)
    if conf is not None:
        # Offline dá pra pegar detecções mais fracas (multidão, pessoa pequena).
        cfg.det_conf_threshold = conf
        cfg.ocsort_confianca_alta = min(cfg.ocsort_confianca_alta, conf + 0.1)
    regras = RegrasCamera(camera, cfg, FPS_ANALISE, extrator=extrator)
    cap = cv2.VideoCapture(str(web))
    fps_video = cap.get(cv2.CAP_PROP_FPS) or FPS_VIDEO_WEB
    passo = fps_video / FPS_ANALISE
    largura, altura = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    pontos: dict[int, list] = defaultdict(list)
    hist_cima: dict[int, np.ndarray] = {}
    hist_baixo: dict[int, np.ndarray] = {}
    recorte: dict[int, tuple[float, float, np.ndarray]] = {}  # id -> (nota, t, imagem)
    contagem_quadros: list[list] = []  # [t, pessoas detectadas]

    indice, proximo = 0, 0.0
    while True:
        ok, imagem = cap.read()
        if not ok:
            break
        if indice >= proximo:
            proximo += passo
            t = indice / fps_video
            dets = detector.detectar(imagem, cfg.det_conf_threshold)
            rastreadas = regras.atualizar(dets, t, largura, altura, imagem=imagem)
            contagem_quadros.append([round(t, 2), len(dets)])
            caixas = rastreadas.xyxy
            for i, (tid, cx) in enumerate(zip(rastreadas.tracker_id.tolist(), caixas)):
                x1, y1, x2, y2 = (float(v) for v in cx)
                pontos[tid].append([round(t, 2), round(x1 / largura, 4), round(y1 / altura, 4), round(x2 / largura, 4), round(y2 / altura, 4)])
                # Aparência e recorte só com a pessoa sozinha e inteira na imagem.
                inteira = x1 > 2 and y1 > 2 and x2 < largura - 2 and y2 < altura - 2
                if iou_max(caixas, i) > 0.05 or not inteira:
                    continue
                for alvo, faixa in ((hist_cima, (0.2, 0.48)), (hist_baixo, (0.55, 0.85))):
                    hh = histograma_roupa(imagem, (x1, y1, x2, y2), faixa)
                    if hh is not None:
                        alvo[tid] = alvo.get(tid, 0) + hh
                nota = (x2 - x1) * (y2 - y1)
                if tid not in recorte or nota > recorte[tid][0]:
                    m = 0.08 * (y2 - y1)
                    ya, yb = int(max(0, y1 - m)), int(min(altura, y2 + m))
                    xa, xb = int(max(0, x1 - m)), int(min(largura, x2 + m))
                    recorte[tid] = (nota, t, imagem[ya:yb, xa:xb].copy())
        indice += 1
    cap.release()
    duracao = indice / fps_video

    # Só quem ficou o mínimo na imagem conta como pessoa (mesma regra do ao vivo).
    pessoas_ids = [tid for tid, pts in pontos.items() if pts[-1][0] - pts[0][0] >= cfg.min_track_duration_s]

    # Estatura: altura da caixa comparada com a altura típica de um adulto
    # NAQUELE ponto da imagem (perspectiva), ajustada pelos próprios dados.
    estaturas: dict[int, tuple[str, int]] = {}
    if estatura_confiavel:
        ys, hs = [], []
        for tid in pessoas_ids:
            for _, _, y1, _, y2 in pontos[tid]:
                if 0.02 < y1 and y2 < 0.97:
                    ys.append(y2)
                    hs.append(y2 - y1)
        if len(ys) > 30:
            ys, hs = np.array(ys), np.array(hs)
            # Linha pela mediana de faixas de y: robusta a crianças e a caixas cortadas.
            faixas = np.linspace(ys.min(), ys.max(), 8)
            cx, cy = [], []
            for a, b in zip(faixas[:-1], faixas[1:]):
                m = (ys >= a) & (ys < b)
                if m.sum() >= 5:
                    cx.append(ys[m].mean())
                    cy.append(np.percentile(hs[m], 65))
            if len(cx) >= 2:
                coef = np.polyfit(cx, cy, 1)
                for tid in pessoas_ids:
                    # Só caixas inteiras e "em pé": quem está cortado na borda
                    # (perto da câmera) parece baixinho sem ser.
                    razoes = [
                        (y2 - y1) / max(1e-3, np.polyval(coef, y2))
                        for _, x1, y1, x2, y2 in pontos[tid]
                        if 0.02 < y1 and y2 < 0.97 and (x2 - x1) * largura < 0.6 * (y2 - y1) * altura
                    ]
                    if len(razoes) >= 3:
                        r = float(np.median(razoes))
                        cm = int(round(172 * r / 5) * 5)
                        estaturas[tid] = ("crianca" if r < 0.74 else "adulto", cm)

    (PASTA / "recortes").mkdir(parents=True, exist_ok=True)
    pessoas = []
    for n, tid in enumerate(sorted(pessoas_ids, key=lambda k: pontos[k][0][0]), start=1):
        pts = pontos[tid]
        p = {"id": n, "pontos": pts, "entrada": pts[0][0], "saida": pts[-1][0]}
        cima, baixo = cor_dominante(hist_cima.get(tid)), cor_dominante(hist_baixo.get(tid))
        if cima:
            p["cima"] = cima
        if baixo:
            p["baixo"] = baixo
        if tid in estaturas:
            p["estatura"], p["altura_cm"] = estaturas[tid]
        if tid in recorte:
            _, t_rec, img = recorte[tid]
            alvo = cv2.resize(img, (max(1, int(img.shape[1] * 192 / img.shape[0])), 192))
            nome = f"{camera.id}-{n}.jpg"
            # imencode + write_bytes: o cv2.imwrite falha calado com acento no caminho (Windows).
            (PASTA / "recortes" / nome).write_bytes(cv2.imencode(".jpg", alvo, [cv2.IMWRITE_JPEG_QUALITY, 82])[1].tobytes())
            p["recorte"] = f"recortes/{nome}"
            p["t_recorte"] = round(t_rec, 2)
        pessoas.append(p)

    caso = {
        "camera": camera.id,
        "nome": camera.nome,
        "andar": camera.andar,
        "corredor": camera.corredor,
        "credito": camera.credito,
        "video": f"videos/{web.name}",
        "duracao_s": round(duracao, 2),
        "largura": largura,
        "altura": altura,
        "fps_analise": FPS_ANALISE,
        "estatura_confiavel": estatura_confiavel and bool(estaturas),
        "pessoas": pessoas,
        "detectadas_por_quadro": contagem_quadros,
        "gerado_em": time.strftime("%Y-%m-%d %H:%M"),
    }
    saida.write_text(json.dumps(caso, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    criancas = sum(1 for p in pessoas if p.get("estatura") == "crianca")
    print(f"  {len(pessoas)} pessoas ({criancas} crianças) em {duracao:.0f} s -> {saida.name}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refazer", action="store_true")
    ap.add_argument("--camera", help="só esta câmera (id)")
    ap.add_argument("--modelo", default=MODELO, help=f"modelo RF-DETR (padrão {MODELO})")
    ap.add_argument("--conf", type=float, default=CONF, help=f"confiança mínima (padrão {CONF})")
    args = ap.parse_args()

    motor = MotorConfig.carregar()
    motor.modelo = args.modelo
    cameras = {c.id: c for c in carregar_cameras()}
    detector = DetectorPessoas(motor)
    extrator = None
    if motor.reid == "osnet":
        from argus_visao.reid import ExtratorReid

        extrator = ExtratorReid()

    for cid, estatura in CAMERAS:
        if args.camera and cid != args.camera:
            continue
        print(f"[casos] {cid}")
        analisar(cameras[cid], estatura, detector, extrator, args.refazer, args.conf)

    indice = []
    for cid, _ in CAMERAS:
        f = PASTA / f"{cid}.json"
        if f.exists():
            c = json.loads(f.read_text(encoding="utf-8"))
            indice.append({k: c[k] for k in ("camera", "nome", "andar", "corredor", "duracao_s")} | {"pessoas": len(c["pessoas"])})
    (PASTA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[casos] índice com {len(indice)} câmeras")


if __name__ == "__main__":
    main()
