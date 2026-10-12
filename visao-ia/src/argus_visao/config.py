"""Configuração do motor de visão: modelo/dispositivo, parâmetros do
tracker e cadastro das câmeras.

Tudo vem de arquivos JSON (`config/motor.json`, `config/cameras.json`,
`presets/*.json`), pra trocar modelo, dispositivo (CPU/MPS/CUDA) e
câmeras sem mexer em código.

NOTA sobre `lost_track_buffer` (conferido no código do supervision
0.30.5): o ByteTrack calcula `max_time_lost = frame_rate / 30 *
lost_track_buffer` (em frames), ou seja, o tempo real de espera é
sempre `lost_track_buffer / 30` segundos. Por isso aqui você configura
em SEGUNDOS, passamos `frame_rate` = fps REAL de análise e derivamos
`lost_track_buffer = segundos * 30`. Assim `max_time_lost` sai em
frames de análise corretos (ex.: 4 fps x 2,5 s = 10 frames).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CONFIG_DIR = RAIZ / "config"
PRESETS_DIR = RAIZ / "presets"


@dataclass
class MotorConfig:
    # Modelo de detecção: "rfdetr-nano" | "rfdetr-small" | "rfdetr-medium" | "rfdetr-base"
    modelo: str = "rfdetr-nano"
    # "auto" escolhe cuda > mps > cpu. Pode forçar "cuda", "cuda:1", "mps" ou "cpu".
    dispositivo: str = "auto"
    # Meia precisão (fp16) só é usada em CUDA; ignorado em MPS/CPU.
    fp16_em_cuda: bool = True
    # Largura máxima dos quadros enviados ao painel (só exibição, não afeta a IA).
    previa_largura_max: int = 960
    previa_qualidade_jpeg: int = 75
    # Teto de fps de análise das câmeras que ninguém está assistindo no
    # painel (null = sem teto). Com hardware fraco (CPU), deixa a câmera
    # aberta na tela com o fps cheio e as demais contando mais devagar.
    fps_analise_sem_espectador: float | None = None
    # Re-ID (ver reid.py): "osnet" (aparência da pessoa inteira, só na câmera
    # aberta no painel) ou "histograma" (só cor da roupa, sem modelo extra).
    reid: str = "osnet"

    @classmethod
    def carregar(cls, caminho: Path | None = None) -> "MotorConfig":
        caminho = caminho or CONFIG_DIR / "motor.json"
        if not caminho.exists():
            return cls()
        return cls(**json.loads(caminho.read_text(encoding="utf-8")))


@dataclass
class TrackerConfig:
    nome: str = "default"

    # Detector: confiança mínima pra aceitar uma pessoa
    det_conf_threshold: float = 0.4

    # Rastreador: "ocsort" (padrão; pacote `trackers`, lida melhor com
    # oclusão e cruzamento de pessoas) ou "bytetrack" (supervision).
    rastreador: str = "ocsort"
    # OC-SORT: IoU mínimo pra casar caixa prevista e detecção (baixo porque
    # a 3-5 fps a pessoa anda bastante entre análises) e confiança a partir
    # da qual a detecção entra na primeira rodada de associação.
    ocsort_iou_minimo: float = 0.1
    ocsort_confianca_alta: float = 0.5

    # ByteTrack (supervision)
    track_activation_threshold: float = 0.25
    # No supervision é um limiar de DISTÂNCIA (1 - IoU): 0.9 aceita
    # casar caixas com IoU >= 0.1, o que importa a 3-5 fps, quando a
    # pessoa anda bastante entre um quadro analisado e o próximo.
    minimum_matching_threshold: float = 0.9
    minimum_consecutive_frames_s: float = 0.5
    lost_track_buffer_s: float = 2.5

    # Regra de contagem: um track só conta como "visitante único
    # (estimativa)" se durou pelo menos isso, medido em segundos reais.
    min_track_duration_s: float = 1.5

    def minimum_consecutive_frames(self, fps_analise: float) -> int:
        return max(1, round(self.minimum_consecutive_frames_s * fps_analise))

    def lost_track_buffer(self) -> int:
        # Ver nota do módulo: sempre x30, independente do fps.
        return max(1, round(self.lost_track_buffer_s * 30))

    def salvar(self, nome: str | None = None) -> Path:
        nome = nome or self.nome
        PRESETS_DIR.mkdir(exist_ok=True)
        caminho = PRESETS_DIR / f"{nome}.json"
        caminho.write_text(json.dumps(asdict(self), indent=2, ensure_ascii=False), encoding="utf-8")
        return caminho

    @classmethod
    def carregar(cls, nome: str = "default") -> "TrackerConfig":
        caminho = PRESETS_DIR / f"{nome}.json"
        if not caminho.exists():
            return cls(nome=nome)
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        conhecidos = cls.__dataclass_fields__.keys()
        return cls(**{k: v for k, v in dados.items() if k in conhecidos})


@dataclass
class Linha:
    """Linha de contagem (ex.: entrada de um corredor). Coordenadas
    normalizadas 0-1 sobre a imagem da câmera. "Entrada" = cruzar no
    sentido em que o lado esquerdo de (inicio -> fim) fica pra trás."""

    id: str
    nome: str
    inicio: tuple[float, float]
    fim: tuple[float, float]


@dataclass
class Zona:
    """Zona de ocupação (polígono normalizado 0-1 sobre a imagem)."""

    id: str
    nome: str
    poligono: list[tuple[float, float]]


@dataclass
class CameraConfig:
    id: str
    nome: str
    # Arquivo de vídeo, índice de webcam ("0") ou URL RTSP. Padrão Intelbras:
    # rtsp://USUARIO:SENHA@IP:554/cam/realmonitor?channel=N&subtype=1
    fonte: str
    fps_analise: float = 4.0
    preset: str = "default"
    ativa: bool = True
    # Em arquivos de vídeo usados como câmera de teste: zera as contagens
    # a cada volta do vídeo, pra comparar com a contagem manual de UMA passada.
    zerar_ao_reiniciar_video: bool = True
    linhas: list[Linha] = field(default_factory=list)
    zonas: list[Zona] = field(default_factory=list)
    # Campos de negócio já previstos (usados nas próximas etapas)
    andar: str | None = None
    corredor: str | None = None
    area_negocio: str | None = None
    # Origem do vídeo quando não é câmera do cliente (vídeo de demonstração),
    # exibida no painel junto da imagem.
    credito: str | None = None

    @classmethod
    def de_dict(cls, d: dict) -> "CameraConfig":
        d = dict(d)
        d["linhas"] = [Linha(id=l["id"], nome=l["nome"], inicio=tuple(l["inicio"]), fim=tuple(l["fim"])) for l in d.get("linhas", [])]
        d["zonas"] = [Zona(id=z["id"], nome=z["nome"], poligono=[tuple(p) for p in z["poligono"]]) for z in d.get("zonas", [])]
        conhecidos = cls.__dataclass_fields__.keys()
        return cls(**{k: v for k, v in d.items() if k in conhecidos})

    def resolver_fonte(self) -> str:
        """Caminhos relativos de arquivo são relativos à raiz do motor."""
        f = self.fonte
        if f.isdigit() or "://" in f:
            return f
        p = Path(f)
        return str(p if p.is_absolute() else RAIZ / p)

    @property
    def eh_arquivo(self) -> bool:
        return not (self.fonte.isdigit() or "://" in self.fonte)


def carregar_cameras(caminho: Path | None = None) -> list[CameraConfig]:
    caminho = caminho or CONFIG_DIR / "cameras.json"
    if not caminho.exists():
        return []
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    return [CameraConfig.de_dict(c) for c in dados.get("cameras", [])]
