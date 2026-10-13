"""Tracking e regras de contagem de UMA câmera.

Métricas, em ordem de confiabilidade:
  1. Entradas/saídas por LINHA: pessoa cruzou a linha configurada. Não
     depende de o ID se manter estável a vida toda, só durante o
     cruzamento. É a métrica principal nas entradas.
  2. Ocupação por ZONA e na imagem inteira: quantas pessoas estão lá
     AGORA. Também não depende de IDs estáveis.
  3. Visitantes únicos (ESTIMATIVA): quantos tracks diferentes duraram
     pelo menos `min_track_duration_s`. Sensível a troca de ID (oclusão,
     pessoa sumindo atrás de pilar), por isso sempre rotulada como
     estimativa.

Rastreador: OC-SORT (pacote `trackers`, da Roboflow) por padrão. Como o
ByteTrack, associa por sobreposição de caixas, mas corrige a trajetória
quando a pessoa reaparece e usa a direção do movimento, o que reduz troca
de ID em oclusões e cruzamentos. O ByteTrack continua disponível no preset.

Costura de IDs: a 3-5 fps uma pessoa que some por um instante (oclusão,
detecção falha) ainda pode voltar com ID NOVO, duplicando a pessoa nas
contagens e quebrando o caminho dela. Por cima do rastreador, cada ID novo é comparado com as
pessoas perdidas há poucos segundos: se aparece onde a perdida estaria
(posição + velocidade), com altura parecida e com a mesma cor de roupa
(histograma do tronco), herda o ID dela. O painel e as contagens só veem
esse ID estável.

Re-ID (quando há extrator e imagem, ou seja, na câmera aberta no painel):
  - galeria: a cada ~1,5 s, com a pessoa SOZINHA (sem caixa sobreposta),
    guarda o vetor de aparência dela (OSNet, ver reid.py);
  - costura: o ID novo só herda o de uma pessoa perdida se a aparência
    bater com a galeria dela (no lugar do histograma de cor);
  - cruzamento: quando duas pessoas se sobrepõem e depois se separam,
    compara cada uma com as duas galerias; se o rastreador trocou os IDs
    durante o cruzamento, a troca é desfeita.

Durações são medidas em SEGUNDOS pelo timestamp da captura, não em
quadros, pra não depender do fps de análise.
"""

from __future__ import annotations

import warnings
from collections import deque
from dataclasses import dataclass, field

import cv2
import numpy as np
import supervision as sv
import trackers

from .config import CameraConfig, TrackerConfig
from .reid import similaridade

# sv.ByteTrack está marcado como obsoleto desde o supervision 0.28 (vai
# pro pacote `trackers`), mas funciona na versão fixada no pyproject.
warnings.filterwarnings("ignore", category=FutureWarning, module="supervision")

# Descarta da memória tracks não vistos há mais que isso (já foram contados).
ESQUECER_TRACK_APOS_S = 30.0

# Costura: até quanto tempo depois de sumir a pessoa ainda pode herdar o ID,
# e a distância máxima (em alturas da pessoa) entre onde ela deveria estar
# e onde o ID novo apareceu.
COSTURA_JANELA_S = 4.0
COSTURA_DISTANCIA_ALTURAS = 1.2
COSTURA_RAZAO_ALTURA = (0.6, 1.65)
# Distância de Bhattacharyya máxima entre as cores da roupa (0 = iguais,
# 1 = nada em comum). Impede herdar o ID de OUTRA pessoa que estava perto.
# Pessoa pequena na imagem (câmera de baixa resolução, longe) dá um
# histograma ruidoso: aí a cor pesa menos e o limite é mais tolerante.
COSTURA_APARENCIA_MAX = 0.5
COSTURA_APARENCIA_MAX_PESSOA_PEQUENA = 0.7
PESSOA_PEQUENA_ALTURA_PX = 120
# Pontos do caminho guardados por pessoa (~50 s a 3 fps).
CAMINHO_MAX_PONTOS = 150

# Re-ID. Similaridade (cosseno) do OSNet: mesma pessoa ~0,77 e pessoas
# diferentes ~0,55 nos recortes do CAVIAR.
REID_COSTURA_MIN = 0.65
REID_MARGEM_TROCA = 0.1  # trocar só se a troca explicar MELHOR as duas pessoas
REID_CONTATO_IOU = 0.1  # caixas sobrepostas a partir disso = cruzamento
REID_SEPARADOS_IOU = 0.02
REID_CONTATO_JANELA_S = 6.0
REID_INTERVALO_GALERIA_S = 1.5
REID_GALERIA_POR_QUADRO = 1  # ~50 ms cada em CPU
REID_GALERIA_MAX = 8
REID_ALTURA_MIN_PX = 40

# Exibição: pessoa que o detector perdeu por um instante continua no painel
# (caixa na posição prevista, marcada como "sumida") por até este tempo, pra
# caixa não piscar. Só vale pra quem já está há um tempo na imagem.
EXIBIR_SUMIDO_S = 1.5
EXIBIR_SUMIDO_DURACAO_MIN_S = 0.6

# Linhas: faixa morta em volta da linha (fração da largura da imagem) pra o pé
# tremendo em cima da linha não contar ida e volta, e quanto o cruzamento pode
# passar das pontas (fração do comprimento da linha).
LINHA_FAIXA_MORTA = 0.008
LINHA_TOLERANCIA_PONTAS = 0.08


def _iou_matriz(caixas: np.ndarray) -> np.ndarray:
    if len(caixas) == 0:
        return np.zeros((0, 0))
    x1 = np.maximum(caixas[:, None, 0], caixas[None, :, 0])
    y1 = np.maximum(caixas[:, None, 1], caixas[None, :, 1])
    x2 = np.minimum(caixas[:, None, 2], caixas[None, :, 2])
    y2 = np.minimum(caixas[:, None, 3], caixas[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area = (caixas[:, 2] - caixas[:, 0]) * (caixas[:, 3] - caixas[:, 1])
    iou = inter / (area[:, None] + area[None, :] - inter + 1e-9)
    np.fill_diagonal(iou, 0)
    return iou


@dataclass
class _Track:
    primeiro_ts: float
    ultimo_ts: float
    contado: bool = False
    # Em pixels: pé da pessoa (base central da caixa) e altura da caixa.
    pe: tuple[float, float] = (0.0, 0.0)
    altura_px: float = 0.0
    velocidade: tuple[float, float] = (0.0, 0.0)  # px/s, média suavizada
    aparencia: np.ndarray | None = None  # histograma de cor do tronco (média)
    # Pode herdar um ID novo? (não depois que o vídeo de teste recomeça)
    costuravel: bool = True
    caminho: deque = field(default_factory=lambda: deque(maxlen=CAMINHO_MAX_PONTOS))
    # Re-ID: vetores de aparência tirados com a pessoa sozinha na imagem
    galeria: deque = field(default_factory=lambda: deque(maxlen=REID_GALERIA_MAX))
    ultimo_reid_ts: float = float("-inf")

    caixa: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)  # última caixa vista, px

    @property
    def duracao_s(self) -> float:
        return self.ultimo_ts - self.primeiro_ts


class ContadorLinha:
    """Entradas/saídas numa linha, pelo pé de cada pessoa (ID estável).

    Diferente do sv.LineZone, o lado em que a pessoa estava fica guardado
    enquanto o track existir: se ela some por um quadro (comum a 3 fps) ou
    volta com o ID costurado do outro lado, o cruzamento ainda conta. O
    cruzamento vale se o trecho entre a última posição conhecida e a atual
    corta a linha (com folga nas pontas). Mesmo sentido do sv.LineZone:
    "entrada" = terminar do lado em que o produto vetorial com
    (fim - inicio) é negativo."""

    def __init__(self, inicio: tuple[float, float], fim: tuple[float, float], largura: int) -> None:
        self.a = np.array(inicio, dtype=float)
        self.b = np.array(fim, dtype=float)
        self.v = self.b - self.a
        self.comprimento = float(np.hypot(*self.v)) or 1.0
        self.faixa_morta = LINHA_FAIXA_MORTA * largura
        self.entradas = 0
        self.saidas = 0
        # ID -> (lado confirmado: True = lado de "entrada", posição do pé lá)
        self._lado: dict[int, tuple[bool, np.ndarray]] = {}

    def _distancia(self, p: np.ndarray) -> float:
        """Distância com sinal até a linha (negativa = lado de "entrada")."""
        d = p - self.a
        return float(d[0] * self.v[1] - d[1] * self.v[0]) / self.comprimento

    def atualizar(self, tid: int, pe: tuple[float, float]) -> None:
        p = np.array(pe, dtype=float)
        dist = self._distancia(p)
        if abs(dist) < self.faixa_morta:
            return  # em cima da linha: espera definir o lado
        lado = dist < 0
        anterior = self._lado.get(tid)
        self._lado[tid] = (lado, p)
        if anterior is None or anterior[0] == lado:
            return
        # Onde o trecho anterior -> atual corta a linha (0 = inicio, 1 = fim)
        p0 = anterior[1]
        d0 = self._distancia(p0)
        x = p0 + (p - p0) * (d0 / (d0 - dist))
        u = float(np.dot(x - self.a, self.v)) / self.comprimento**2
        if -LINHA_TOLERANCIA_PONTAS <= u <= 1 + LINHA_TOLERANCIA_PONTAS:
            if lado:
                self.entradas += 1
            else:
                self.saidas += 1

    def esquecer(self, vivos: set[int]) -> None:
        self._lado = {tid: v for tid, v in self._lado.items() if tid in vivos}

    def renomear(self, a: int, b: int) -> None:
        """IDs destrocados pelo Re-ID: o lado de cada um vai junto."""
        la, lb = self._lado.pop(a, None), self._lado.pop(b, None)
        if la is not None:
            self._lado[b] = la
        if lb is not None:
            self._lado[a] = lb


class Rastreador:
    """Interface única sobre o rastreador escolhido no preset: recebe as
    detecções + timestamp da captura e devolve só pessoas confirmadas."""

    def __init__(self, cfg: TrackerConfig, fps_analise: float) -> None:
        self.cfg = cfg
        self.fps_analise = fps_analise
        self.reset()

    def reset(self) -> None:
        cfg, fps = self.cfg, self.fps_analise
        if cfg.rastreador == "bytetrack":
            self._interno = sv.ByteTrack(
                track_activation_threshold=cfg.track_activation_threshold,
                lost_track_buffer=cfg.lost_track_buffer(),
                minimum_matching_threshold=cfg.minimum_matching_threshold,
                frame_rate=fps,
                minimum_consecutive_frames=cfg.minimum_consecutive_frames(fps),
            )
        elif cfg.rastreador == "ocsort":
            # lost_track_buffer também em "quadros de 30 fps" (ver config.py)
            self._interno = trackers.OCSORTTracker(
                lost_track_buffer=cfg.lost_track_buffer(),
                frame_rate=fps,
                minimum_consecutive_frames=cfg.minimum_consecutive_frames(fps),
                minimum_iou_threshold=cfg.ocsort_iou_minimo,
                high_conf_det_threshold=cfg.ocsort_confianca_alta,
            )
        else:
            raise ValueError(f"rastreador desconhecido: {cfg.rastreador} (opções: ocsort, bytetrack)")

    def atualizar(self, deteccoes: sv.Detections, ts: float) -> sv.Detections:
        if isinstance(self._interno, sv.ByteTrack):
            rastreadas = self._interno.update_with_detections(deteccoes)
        else:
            # timestamp real: o fps de análise varia (câmera aberta x fundo)
            rastreadas = self._interno.update(deteccoes, timestamp=ts)
            if rastreadas.tracker_id is not None:
                rastreadas = rastreadas[rastreadas.tracker_id >= 0]  # -1 = ainda não confirmado
        if rastreadas.tracker_id is None:
            rastreadas.tracker_id = np.array([], dtype=int)
        return rastreadas


class RegrasCamera:
    def __init__(self, camera: CameraConfig, cfg: TrackerConfig, fps_analise: float, extrator=None) -> None:
        self.camera = camera
        self.cfg = cfg
        self.fps_analise = fps_analise
        self.extrator = extrator  # reid.ExtratorReid ou None
        self.tracker = Rastreador(cfg, fps_analise)
        self._tamanho: tuple[int, int] | None = None
        self._linhas: dict[str, ContadorLinha] = {}
        self._zonas: dict[str, sv.PolygonZone] = {}
        self._zerar_contadores()

    def _zerar_contadores(self) -> None:
        self._tracks: dict[int, _Track] = {}
        # ID do rastreador -> ID estável (o que o painel e as contagens veem)
        self._id_estavel: dict[int, int] = {}
        self._proximo_id = 1
        self.visitantes_estimados = 0
        self.ids_criados = 0
        self.ids_costurados = 0
        self.trocas_desfeitas = 0
        # par de IDs (menor, maior) -> último instante em que as caixas se sobrepuseram
        self._contatos: dict[tuple[int, int], float] = {}
        self.ocupacao = 0
        self.pessoas_detectadas = 0
        self.ocupacao_zonas: dict[str, int] = {z.id: 0 for z in self.camera.zonas}
        # Duração dos tracks já encerrados (pro relatório de debug)
        self.duracoes_encerradas: deque[float] = deque(maxlen=500)
        if self._tamanho:
            self._montar_geometria(*self._tamanho)

    def zerar(self) -> None:
        self.tracker.reset()
        self._zerar_contadores()

    def reiniciar_tracker(self) -> None:
        """Nova volta do vídeo de teste: o rastreador recomeça a numeração e
        ninguém do fim do vídeo pode herdar ID de quem entra no começo."""
        self.tracker.reset()
        self._id_estavel.clear()
        self._contatos.clear()
        for t in self._tracks.values():
            t.costuravel = False

    def _montar_geometria(self, largura: int, altura: int) -> None:
        self._tamanho = (largura, altura)
        self._linhas = {
            l.id: ContadorLinha((l.inicio[0] * largura, l.inicio[1] * altura), (l.fim[0] * largura, l.fim[1] * altura), largura)
            for l in self.camera.linhas
        }
        self._zonas = {
            z.id: sv.PolygonZone(
                polygon=np.array([[x * largura, y * altura] for x, y in z.poligono], dtype=np.int64),
                triggering_anchors=(sv.Position.BOTTOM_CENTER,),
            )
            for z in self.camera.zonas
        }

    def atualizar(self, deteccoes: sv.Detections, ts: float, largura: int, altura: int, imagem: np.ndarray | None = None) -> sv.Detections:
        """`imagem` (opcional) liga o Re-ID neste quadro, se houver extrator."""
        if self._tamanho != (largura, altura):
            self._montar_geometria(largura, altura)
        reid = imagem if self.extrator is not None else None

        rastreadas = self.tracker.atualizar(deteccoes, ts)
        ids = self._ids_estaveis(rastreadas, ts, reid)
        if reid is not None:
            ids = self._desfazer_trocas(rastreadas.xyxy, ids, ts, reid)
        rastreadas.tracker_id = ids

        aparencias = rastreadas.data.get("aparencia")
        for i, (tid, (x1, y1, x2, y2)) in enumerate(zip(rastreadas.tracker_id.tolist(), rastreadas.xyxy.tolist())):
            pe = ((x1 + x2) / 2, y2)
            aparencia = aparencias[i] if aparencias is not None and aparencias[i].any() else None
            t = self._tracks.get(tid)
            if t is None:
                t = self._tracks[tid] = _Track(primeiro_ts=ts, ultimo_ts=ts, pe=pe, altura_px=y2 - y1, aparencia=aparencia)
                self.ids_criados += 1
            else:
                if aparencia is not None:
                    t.aparencia = aparencia if t.aparencia is None else 0.8 * t.aparencia + 0.2 * aparencia
                dt = ts - t.ultimo_ts
                if dt > 0:
                    v = ((pe[0] - t.pe[0]) / dt, (pe[1] - t.pe[1]) / dt)
                    t.velocidade = (0.5 * t.velocidade[0] + 0.5 * v[0], 0.5 * t.velocidade[1] + 0.5 * v[1])
                t.pe = pe
                t.altura_px = 0.7 * t.altura_px + 0.3 * (y2 - y1)
            t.ultimo_ts = ts
            t.caixa = (x1, y1, x2, y2)
            for linha in self._linhas.values():
                linha.atualizar(tid, pe)
            t.caminho.append((round(pe[0] / largura, 4), round(pe[1] / altura, 4)))
            if not t.contado and t.duracao_s >= self.cfg.min_track_duration_s:
                t.contado = True
                self.visitantes_estimados += 1

        if reid is not None:
            self._atualizar_galerias(rastreadas.xyxy, rastreadas.tracker_id, ts, reid)

        for tid in [tid for tid, t in self._tracks.items() if ts - t.ultimo_ts > ESQUECER_TRACK_APOS_S]:
            self.duracoes_encerradas.append(self._tracks.pop(tid).duracao_s)
        vivos = set(self._tracks)
        self._id_estavel = {bruto: est for bruto, est in self._id_estavel.items() if est in vivos}
        for linha in self._linhas.values():
            linha.esquecer(vivos)
        for zid, zona in self._zonas.items():
            zona.trigger(rastreadas)
            self.ocupacao_zonas[zid] = int(zona.current_count)
        self.ocupacao = len(rastreadas)
        self.pessoas_detectadas = len(deteccoes)
        return rastreadas

    def _ids_estaveis(self, rastreadas: sv.Detections, ts: float, imagem: np.ndarray | None = None) -> np.ndarray:
        """Traduz os IDs do rastreador para IDs estáveis, costurando IDs
        novos a pessoas perdidas há pouco (ver docstring do módulo)."""
        brutos = rastreadas.tracker_id.tolist()
        estaveis: list[int | None] = [None] * len(brutos)
        usados: set[int] = set()
        for i, bruto in enumerate(brutos):
            est = self._id_estavel.get(bruto)
            if est is not None and est not in usados:
                estaveis[i] = est
                usados.add(est)

        novos = [i for i, e in enumerate(estaveis) if e is None]
        if novos:
            candidatos = [
                (tid, t)
                for tid, t in self._tracks.items()
                if tid not in usados and t.costuravel and 0 < ts - t.ultimo_ts <= COSTURA_JANELA_S
            ]
            pares = []
            aparencias = rastreadas.data.get("aparencia")
            for i in novos:
                x1, y1, x2, y2 = rastreadas.xyxy[i]
                pe, altura = ((x1 + x2) / 2, y2), y2 - y1
                aparencia = aparencias[i] if aparencias is not None and aparencias[i].any() else None
                vetor = None  # Re-ID do ID novo: calculado só se algum candidato precisar
                for tid, t in candidatos:
                    if not (COSTURA_RAZAO_ALTURA[0] <= altura / max(t.altura_px, 1) <= COSTURA_RAZAO_ALTURA[1]):
                        continue
                    if imagem is not None and t.galeria:
                        if vetor is None:
                            vetor = self.extrator.descrever(imagem, rastreadas.xyxy[i]) if self.extrator else None
                            vetor = vetor if vetor is not None else False
                        if vetor is not False and similaridade(vetor, t.galeria) < REID_COSTURA_MIN:
                            continue
                    elif aparencia is not None and t.aparencia is not None:
                        pequena = min(altura, t.altura_px) < PESSOA_PEQUENA_ALTURA_PX
                        limite = COSTURA_APARENCIA_MAX_PESSOA_PEQUENA if pequena else COSTURA_APARENCIA_MAX
                        if cv2.compareHist(aparencia, t.aparencia.astype(np.float32), cv2.HISTCMP_BHATTACHARYYA) > limite:
                            continue
                    dt = ts - t.ultimo_ts
                    previsto = (t.pe[0] + t.velocidade[0] * dt, t.pe[1] + t.velocidade[1] * dt)
                    dist = np.hypot(pe[0] - previsto[0], pe[1] - previsto[1]) / max(t.altura_px, 1)
                    if dist <= COSTURA_DISTANCIA_ALTURAS:
                        pares.append((dist, i, tid))
            for _, i, tid in sorted(pares):
                if estaveis[i] is None and tid not in usados:
                    estaveis[i] = tid
                    usados.add(tid)
                    self.ids_costurados += 1

        for i, bruto in enumerate(brutos):
            if estaveis[i] is None:
                estaveis[i] = self._proximo_id
                self._proximo_id += 1
            self._id_estavel[bruto] = estaveis[i]
        return np.array(estaveis, dtype=int)

    def _desfazer_trocas(self, caixas: np.ndarray, ids: np.ndarray, ts: float, imagem: np.ndarray) -> np.ndarray:
        """Depois de um cruzamento, confere pela aparência se os IDs das duas
        pessoas foram trocados e, se foram, destroca."""
        iou = _iou_matriz(caixas)
        pos = {int(tid): i for i, tid in enumerate(ids)}
        agora: set[tuple[int, int]] = set()
        for i, j in zip(*np.nonzero(np.triu(iou) > REID_CONTATO_IOU)):
            par = tuple(sorted((int(ids[i]), int(ids[j]))))
            self._contatos[par] = ts
            agora.add(par)

        for par, quando in list(self._contatos.items()):
            if ts - quando > REID_CONTATO_JANELA_S:
                del self._contatos[par]
                continue
            a, b = par
            if par in agora or a not in pos or b not in pos:
                continue  # ainda juntos, ou um deles está encoberto: espera
            ia, ib = pos[a], pos[b]
            if iou[ia, ib] > REID_SEPARADOS_IOU:
                continue
            del self._contatos[par]
            ta, tb = self._tracks.get(a), self._tracks.get(b)
            if ta is None or tb is None or not ta.galeria or not tb.galeria:
                continue
            va = self.extrator.descrever(imagem, caixas[ia])
            vb = self.extrator.descrever(imagem, caixas[ib])
            if va is None or vb is None:
                continue
            manter = similaridade(va, ta.galeria) + similaridade(vb, tb.galeria)
            trocar = similaridade(va, tb.galeria) + similaridade(vb, ta.galeria)
            if trocar > manter + REID_MARGEM_TROCA:
                ids[ia], ids[ib] = b, a
                self._id_estavel = {bruto: (b if est == a else a if est == b else est) for bruto, est in self._id_estavel.items()}
                for linha in self._linhas.values():
                    linha.renomear(a, b)
                self.trocas_desfeitas += 1
                va, vb = vb, va
            # recém-separadas e conferidas: bons exemplos pra galeria
            for t, v in ((self._tracks[int(ids[ia])], va), (self._tracks[int(ids[ib])], vb)):
                t.galeria.append(v)
                t.ultimo_reid_ts = ts
        return ids

    def _atualizar_galerias(self, caixas: np.ndarray, ids: np.ndarray, ts: float, imagem: np.ndarray) -> None:
        """Guarda a aparência de quem está sozinho na imagem, a cada ~1,5 s,
        priorizando quem está há mais tempo sem atualização."""
        iou = _iou_matriz(caixas)
        fila = []
        for i, tid in enumerate(ids.tolist()):
            t = self._tracks.get(tid)
            sozinho = len(caixas) == 1 or iou[i].max() < REID_SEPARADOS_IOU
            if t and sozinho and caixas[i][3] - caixas[i][1] >= REID_ALTURA_MIN_PX and ts - t.ultimo_reid_ts >= REID_INTERVALO_GALERIA_S:
                fila.append((t.ultimo_reid_ts, i, t))
        for _, i, t in sorted(fila, key=lambda x: x[0])[:REID_GALERIA_POR_QUADRO]:
            vetor = self.extrator.descrever(imagem, caixas[i])
            if vetor is not None:
                t.galeria.append(vetor)
                t.ultimo_reid_ts = ts

    def caminhos(self, ids: list[int]) -> dict[int, list[tuple[float, float]]]:
        """Caminho (pés, coordenadas 0-1) de cada pessoa pedida."""
        return {tid: list(self._tracks[tid].caminho) for tid in ids if tid in self._tracks}

    def sumidos(self, ts: float, presentes: set[int]) -> list[tuple[int, tuple[float, float, float, float]]]:
        """Pessoas que o detector perdeu há menos de EXIBIR_SUMIDO_S, com a
        caixa onde deveriam estar agora (última caixa + velocidade). Só pra
        exibição: não entram em ocupação nem em contagem."""
        resultado = []
        for tid, t in self._tracks.items():
            dt = ts - t.ultimo_ts
            if tid in presentes or not t.costuravel or not 0 < dt <= EXIBIR_SUMIDO_S or t.duracao_s < EXIBIR_SUMIDO_DURACAO_MIN_S:
                continue
            dx, dy = t.velocidade[0] * min(dt, 0.7), t.velocidade[1] * min(dt, 0.7)
            x1, y1, x2, y2 = t.caixa
            resultado.append((tid, (x1 + dx, y1 + dy, x2 + dx, y2 + dy)))
        return resultado

    def duracoes_ativas(self) -> dict[int, float]:
        return {tid: round(t.duracao_s, 1) for tid, t in self._tracks.items()}

    def estatisticas(self) -> dict:
        todas = list(self.duracoes_encerradas) + [t.duracao_s for t in self._tracks.values()]
        return {
            "ocupacao_atual": self.ocupacao,
            # Detecções da última análise, sem depender do rastreio: vale
            # mesmo com fps de análise baixo (câmeras fora da tela).
            "pessoas_detectadas": self.pessoas_detectadas,
            "ocupacao_zonas": [{"id": z.id, "nome": z.nome, "ocupacao": self.ocupacao_zonas.get(z.id, 0)} for z in self.camera.zonas],
            "linhas": [
                {"id": l.id, "nome": l.nome, "entradas": self._linhas[l.id].entradas, "saidas": self._linhas[l.id].saidas}
                for l in self.camera.linhas
                if l.id in self._linhas
            ],
            "visitantes_unicos_estimado": self.visitantes_estimados,
            "ids_criados": self.ids_criados,
            # IDs novos do rastreador que herdaram o ID de uma pessoa perdida.
            "ids_costurados": self.ids_costurados,
            # Cruzamentos em que o Re-ID percebeu IDs trocados e destrocou.
            "trocas_desfeitas": self.trocas_desfeitas,
            "duracao_media_track_s": round(sum(todas) / len(todas), 1) if todas else None,
            # Só tracks já encerrados: um track ativo ainda pode crescer.
            "tracks_curtos_encerrados": sum(1 for d in self.duracoes_encerradas if d < self.cfg.min_track_duration_s),
        }
