"""Configuração do tracker e das regras de contagem, tudo parametrizável
por câmera (cada ambiente real vai precisar da própria calibração).

NOTA IMPORTANTE sobre `lost_track_buffer` (ver diagnóstico em
DIAGNOSTICO.md): no supervision 0.30.5, o tempo real (em segundos) que
o ByteTrack espera antes de desistir de um track perdido é
`lost_track_buffer / 30`, INDEPENDENTE do `frame_rate` informado — o
parâmetro `frame_rate` não entra em nenhum outro cálculo do tracker
(conferido no código-fonte). Ou seja, calcular
`lost_track_buffer = fps_real * segundos_desejados` (como se poderia
supor) dá um buffer errado sempre que o vídeo não é 30fps. Por isso
aqui você configura em SEGUNDOS desejados e o valor certo de
`lost_track_buffer` é derivado com `/30` fixo, não com o fps real.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

PRESETS_DIR = Path(__file__).parent / "presets"
PRESETS_DIR.mkdir(exist_ok=True)


@dataclass
class TrackerConfig:
    nome: str = "default"

    # Tracker a usar: "bytetrack" (supervision, baseado em movimento) ou
    # "botsort_reid" (ultralytics, movimento + aparência/Re-ID)
    tracker_tipo: str = "bytetrack"

    # Detector (YOLOv8n, classe "pessoa")
    det_conf_threshold: float = 0.4

    # ByteTrack (supervision) — nomes iguais aos parâmetros reais da lib
    track_activation_threshold: float = 0.25
    minimum_matching_threshold: float = 0.8
    minimum_consecutive_frames_s: float = 0.5  # convertido pra frames usando o fps REAL do vídeo
    lost_track_buffer_s: float = 2.5  # convertido com /30 fixo, ver nota acima
    frame_rate: float = 30.0  # sobrescrito automaticamente pelo fps real do vídeo ao iniciar

    # BoT-SORT (ultralytics), só usado se tracker_tipo == "botsort_reid"
    botsort_track_buffer: int = 30
    botsort_match_thresh: float = 0.8
    botsort_with_reid: bool = True

    # Regra de contagem: um track só vira "visitante único" se durar >= isso
    min_track_duration_s: float = 1.5

    # Linha de entrada (fração da altura do frame, 0.0 = topo, 1.0 = base)
    linha_entrada_y_frac: float = 0.5

    # Idade/gênero
    rosto_min_px: int = 70  # lado mínimo (em pixels) da caixa do rosto pra aceitar a amostra
    max_amostras_rosto: int = 5
    analisar_a_cada_n_frames: int = 5
    exigir_frontal: bool = True

    def minimum_consecutive_frames(self, fps_real: float) -> int:
        return max(1, round(self.minimum_consecutive_frames_s * fps_real))

    def lost_track_buffer(self) -> int:
        # Ver nota do módulo: sempre /30, não fps_real.
        return max(1, round(self.lost_track_buffer_s * 30))

    def salvar(self, nome: str | None = None) -> Path:
        nome = nome or self.nome
        caminho = PRESETS_DIR / f"{nome}.json"
        caminho.write_text(json.dumps(asdict(self), indent=2, ensure_ascii=False), encoding="utf-8")
        return caminho

    @classmethod
    def carregar(cls, nome: str = "default") -> "TrackerConfig":
        caminho = PRESETS_DIR / f"{nome}.json"
        if not caminho.exists():
            return cls(nome=nome)
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        return cls(**dados)
