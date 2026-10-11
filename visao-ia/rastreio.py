"""Motor de rastreio ao vivo (usado pelo painel web, app.py): pessoas +
estimativa de gênero e idade pelo rosto, com 3 métricas separadas (ver
DIAGNOSTICO.md pra explicação de cada uma):

  - entradas_linha: pessoas que cruzaram a linha de entrada (mais
    confiável, não depende de contar IDs distintos).
  - ocupacao_atual: quantas pessoas estão na tela agora.
  - visitantes_unicos_estimado: quantos tracks diferentes existiram e
    duraram pelo menos `min_track_duration_s` (filtra "pessoas
    fantasma" de detecções efêmeras, mas ainda é sensível a troca de ID
    do tracker — por isso "estimado", não a métrica principal).

Não guarda foto nem embedding de rosto em disco: só o resultado
agregado (gênero por voto majoritário, idade por mediana, em faixa
etária) por ID de rastreio, perdido quando o processo reinicia.
"""

from __future__ import annotations

import threading
import time
from collections import Counter
from dataclasses import dataclass, field

import cv2
import numpy as np
import supervision as sv
from insightface.app import FaceAnalysis
from ultralytics import YOLO

from config import TrackerConfig
from nucleo import abrir_fonte, criar_tracker, fps_real_da_fonte

FAIXAS_ETARIAS = [
    (0, 18, "0-17"),
    (18, 25, "18-24"),
    (25, 35, "25-34"),
    (35, 45, "35-44"),
    (45, 60, "45-59"),
    (60, 999, "60+"),
]


def faixa_etaria(idade: float) -> str:
    for lo, hi, label in FAIXAS_ETARIAS:
        if lo <= idade < hi:
            return label
    return "60+"


def _kps_indicam_frontal(kps: np.ndarray) -> bool:
    """Heurística leve de frontalidade a partir dos 5 pontos do
    InsightFace (olho esq., olho dir., nariz, boca esq., boca dir.):
    se o nariz está bem deslocado pra um dos lados em relação à linha
    dos olhos, é perfil, não frente. Não é pose estimation de verdade,
    é só um filtro barato pra não estimar idade/gênero num rosto de
    perfil ou muito de lado."""
    if kps is None or len(kps) < 3:
        return True  # sem landmarks, não filtra por frontalidade
    olho_e, olho_d, nariz = kps[0], kps[1], kps[2]
    largura_olhos = abs(olho_d[0] - olho_e[0])
    if largura_olhos < 1e-3:
        return False
    centro_olhos_x = (olho_e[0] + olho_d[0]) / 2
    desvio = abs(nariz[0] - centro_olhos_x) / largura_olhos
    return desvio < 0.55  # tolerância; > isso já é bem de lado


@dataclass
class Visitante:
    track_id: int
    generos: Counter = field(default_factory=Counter)
    idades: list[float] = field(default_factory=list)
    frame_primeiro: int = 0
    frame_ultimo: int = 0

    def registrar_frame(self, frame_idx: int) -> None:
        if self.frame_primeiro == 0:
            self.frame_primeiro = frame_idx
        self.frame_ultimo = frame_idx

    def duracao_frames(self) -> int:
        return max(1, self.frame_ultimo - self.frame_primeiro + 1)

    def duracao_s(self, fps: float) -> float:
        return self.duracao_frames() / fps if fps else 0.0

    @property
    def genero_estimado(self) -> str | None:
        if not self.generos:
            return None
        return self.generos.most_common(1)[0][0]

    @property
    def idade_mediana(self) -> float | None:
        if not self.idades:
            return None
        s = sorted(self.idades)
        n = len(s)
        return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2

    @property
    def faixa_etaria_estimada(self) -> str | None:
        idade = self.idade_mediana
        return faixa_etaria(idade) if idade is not None else None

    @property
    def amostras(self) -> int:
        return len(self.idades)

    @property
    def indeterminado(self) -> bool:
        return self.genero_estimado is None


class Rastreador:
    def __init__(self, cfg: TrackerConfig | None = None) -> None:
        self.cfg = cfg or TrackerConfig.carregar()

        print("[rastreio] carregando YOLOv8n...")
        self.model = YOLO("yolov8n.pt")

        print("[rastreio] carregando InsightFace (buffalo_l: detecção + gênero/idade)...")
        self.face_app = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "genderage"])
        self.face_app.prepare(ctx_id=0, det_thresh=0.4, det_size=(320, 320))

        self.box_annotator = sv.BoxAnnotator()
        # texto maior de propósito: é a idade (faixa etária) e o gênero
        # por pessoa, precisa dar pra ler ao vivo na tela, não só no hover.
        self.label_annotator = sv.LabelAnnotator(text_scale=0.85, text_thickness=2, text_padding=6)
        self.trace_annotator = sv.TraceAnnotator()

        self._lock = threading.Lock()
        self._visitantes: dict[int, Visitante] = {}
        self._ids_na_tela: set[int] = set()
        self._frame_jpeg: bytes | None = None
        self._frame_contador = 0
        self._fps_real = 30.0

        self._tracker = None
        self._line_zone: sv.LineZone | None = None
        self._linha_w = 640
        self._linha_h = 480
        self._cap: cv2.VideoCapture | None = None
        self._thread: threading.Thread | None = None
        self._rodando = False
        self._fonte_atual: str | None = None
        self._erro: str | None = None

    # ---------- controle de fonte ----------

    def iniciar(self, fonte: str | int) -> None:
        self.parar()
        with self._lock:
            self._visitantes.clear()
            self._ids_na_tela.clear()
            self._frame_contador = 0
            self._erro = None
            self._fonte_atual = str(fonte)
        self._rodando = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _criar_line_zone(self) -> sv.LineZone:
        y = int(self._linha_h * self.cfg.linha_entrada_y_frac)
        return sv.LineZone(start=sv.Point(0, y), end=sv.Point(self._linha_w, y))

    def resetar(self) -> None:
        """Zera os contadores (visitantes, ocupação, entradas/saídas) sem
        parar a fonte de vídeo atual. Útil pra recomeçar a contagem do
        zero num teste longo sem precisar reenviar o vídeo."""
        with self._lock:
            self._visitantes.clear()
            self._ids_na_tela.clear()
        if self._tracker is not None:
            self._tracker.reset()
        if self._line_zone is not None:
            self._line_zone = self._criar_line_zone()

    def parar(self) -> None:
        self._rodando = False
        if self._thread is not None:
            self._thread.join(timeout=2)
        self._thread = None
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    @property
    def ativo(self) -> bool:
        return self._rodando

    @property
    def fonte_atual(self) -> str | None:
        return self._fonte_atual

    @property
    def erro(self) -> str | None:
        return self._erro

    # ---------- loop principal ----------

    def _loop(self) -> None:
        fonte = self._fonte_atual
        try:
            cap = abrir_fonte(fonte)
        except RuntimeError as e:
            with self._lock:
                self._erro = str(e)
            self._rodando = False
            return
        self._cap = cap

        self._fps_real = fps_real_da_fonte(cap)
        self._tracker = criar_tracker(self.model, self.cfg, self._fps_real)

        eh_video_arquivo = not str(fonte).lstrip("-").isdigit()
        self._linha_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
        self._linha_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
        self._line_zone = self._criar_line_zone()

        while self._rodando:
            ok, frame = cap.read()
            if not ok:
                if eh_video_arquivo:
                    # Vídeo de teste "rodando como se fosse a câmera ao vivo":
                    # ao chegar no fim, volta pro início. Reseta o tracker
                    # pra não arrastar tracks antigos pro novo loop (isso
                    # inflaria a contagem de visitantes únicos).
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    self._tracker.reset()
                    with self._lock:
                        self._ids_na_tela.clear()
                    continue
                break

            self._processar_frame(frame)

        cap.release()
        self._rodando = False

    def _processar_frame(self, frame: np.ndarray) -> None:
        self._frame_contador += 1
        h, w = frame.shape[:2]

        detections = self._tracker.update(frame)
        self._line_zone.trigger(detections)

        ids_neste_frame: set[int] = set()
        if detections.tracker_id is not None:
            for i, track_id in enumerate(detections.tracker_id):
                track_id = int(track_id)
                ids_neste_frame.add(track_id)
                with self._lock:
                    visitante = self._visitantes.setdefault(track_id, Visitante(track_id=track_id))
                    visitante.registrar_frame(self._frame_contador)

                precisa_amostra = (
                    visitante.amostras < self.cfg.max_amostras_rosto
                    and self._frame_contador % self.cfg.analisar_a_cada_n_frames == 0
                )
                if precisa_amostra:
                    x1, y1, x2, y2 = detections.xyxy[i].astype(int)
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    if x2 > x1 and y2 > y1:
                        self._analisar_rosto(frame[y1:y2, x1:x2], visitante)

        with self._lock:
            self._ids_na_tela = ids_neste_frame

        if detections.tracker_id is not None:
            labels = []
            for track_id in detections.tracker_id:
                v = self._visitantes[int(track_id)]
                if v.indeterminado:
                    labels.append(f"#{track_id} analisando...")
                else:
                    genero = "H" if v.genero_estimado == "M" else "M"
                    labels.append(f"#{track_id} {genero} {v.faixa_etaria_estimada}")
        else:
            # detecção ainda sem ID confirmado (ex.: BoT-SORT em fase de
            # confirmação) — mantém 1 label por detecção mesmo assim,
            # supervision exige a contagem igual.
            labels = ["? (sem ID ainda)" for _ in range(len(detections))]

        annotated = frame.copy()
        annotated = self.trace_annotator.annotate(scene=annotated, detections=detections)
        annotated = self.box_annotator.annotate(scene=annotated, detections=detections)
        annotated = self.label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
        # Linha de entrada tirada da exibição por enquanto (a pedido) —
        # continua sendo calculada em estatisticas()["entradas_linha"]
        # internamente, só não aparece na tela nem no painel.

        stats = self.estatisticas()
        cv2.putText(
            annotated,
            f"Ocupacao: {stats['ocupacao_atual']}  Visitantes(est.): {stats['visitantes_unicos_estimado']}",
            (10, h - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 255, 0),
            2,
        )

        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok:
            with self._lock:
                self._frame_jpeg = buf.tobytes()

    def _analisar_rosto(self, recorte_bgr: np.ndarray, visitante: Visitante) -> None:
        try:
            rostos = self.face_app.get(recorte_bgr)
        except Exception as e:
            print(f"[rastreio] falha ao analisar rosto do #{visitante.track_id}: {e}")
            return
        if not rostos:
            return
        rosto = max(rostos, key=lambda f: f.det_score)

        x1, y1, x2, y2 = rosto.bbox
        lado_min = min(x2 - x1, y2 - y1)
        if lado_min < self.cfg.rosto_min_px:
            return  # rosto pequeno demais pro recorte da pessoa: amostra descartada, não chuta
        if self.cfg.exigir_frontal and not _kps_indicam_frontal(rosto.kps):
            return  # rosto de perfil: amostra descartada

        with self._lock:
            visitante.generos[rosto.sex] += 1
            visitante.idades.append(float(rosto.age))

    # ---------- leitura de estado (thread-safe) ----------

    def frame_jpeg(self) -> bytes | None:
        with self._lock:
            return self._frame_jpeg

    def estatisticas(self) -> dict:
        with self._lock:
            visitantes = list(self._visitantes.values())
            na_tela = len(self._ids_na_tela)
            fps = self._fps_real

        min_frames = max(1, round(self.cfg.min_track_duration_s * fps))
        visitantes_validos = [v for v in visitantes if v.duracao_frames() >= min_frames]

        com_estimativa = [v for v in visitantes_validos if not v.indeterminado]
        homens = sum(1 for v in com_estimativa if v.genero_estimado == "M")
        mulheres = sum(1 for v in com_estimativa if v.genero_estimado == "F")
        indeterminados = len(visitantes_validos) - len(com_estimativa)
        idades = [v.idade_mediana for v in com_estimativa if v.idade_mediana is not None]

        faixas = {label: 0 for _, _, label in FAIXAS_ETARIAS}
        for v in com_estimativa:
            if v.faixa_etaria_estimada:
                faixas[v.faixa_etaria_estimada] += 1

        return {
            "ativo": self._rodando,
            "fonte": self._fonte_atual,
            "erro": self._erro,
            "fps_real": round(self._fps_real, 1),
            "tracker_tipo": self.cfg.tracker_tipo,
            "ocupacao_atual": na_tela,
            "entradas_linha": int(self._line_zone.in_count) if self._line_zone else 0,
            "saidas_linha": int(self._line_zone.out_count) if self._line_zone else 0,
            "visitantes_unicos_estimado": len(visitantes_validos),
            "ids_criados_total": len(visitantes),
            "homens": homens,
            "mulheres": mulheres,
            "indeterminados": indeterminados,
            "idade_mediana": round(sum(idades) / len(idades), 1) if idades else None,
            "faixas_etarias": faixas,
        }
