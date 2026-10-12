"""Re-identificação de pessoas (Re-ID): um vetor de 512 números que
descreve a APARÊNCIA da pessoa inteira (roupa, silhueta, cores), usado
pra manter o mesmo ID quando ela é encoberta ou cruza com outra pessoa.

Modelo: OSNet x1.0 em ONNX (export da Qualcomm AI Hub, pesos do Torchreid,
licença MIT), rodando no onnxruntime que o motor já usa. Entrada: recorte
da pessoa em 256x128, RGB em [0, 1] (a normalização vem embutida no
modelo; conferido contra recortes reais do CAVIAR). Sem rosto.

ATENÇÃO, licença: os pesos são MIT, mas foram treinados em bases
acadêmicas de Re-ID (Market-1501) com termos de uso de pesquisa. Serve
para demonstração e avaliação; antes de produção comercial, validar com o
jurídico ou treinar com dados próprios. Desligável em config/motor.json
("reid": "histograma").

Custo em CPU: ~50 ms por pessoa (lote fixo de 1). Por isso as regras só
chamam o extrator em momentos específicos (galeria a cada ~1,5 s com a
pessoa sozinha, costura de ID novo, separação depois de um cruzamento) e
só na câmera aberta no painel.
"""

from __future__ import annotations

import io
import threading
import urllib.request
import zipfile
from pathlib import Path

import cv2
import numpy as np

from .config import RAIZ

URL_MODELO = "https://qaihub-public-assets.s3.us-west-2.amazonaws.com/qai-hub-models/models/osnet/releases/v0.64.0/osnet-onnx-float.zip"
PASTA_MODELO = RAIZ / "models" / "osnet"
TAMANHO_ENTRADA = (128, 256)  # largura, altura


def garantir_modelo() -> Path:
    """Baixa o OSNet na primeira vez (como o RF-DETR faz com os pesos dele)."""
    onnx = PASTA_MODELO / "osnet.onnx"
    if onnx.exists() and (PASTA_MODELO / "osnet.data").exists():
        return onnx
    print("[reid] baixando OSNet (8 MB)...")
    PASTA_MODELO.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL_MODELO, timeout=300) as resp:
        pacote = zipfile.ZipFile(io.BytesIO(resp.read()))
    for nome in ("osnet.onnx", "osnet.data"):
        membro = next(m for m in pacote.namelist() if m.endswith("/" + nome))
        (PASTA_MODELO / nome).write_bytes(pacote.read(membro))
    return onnx


class ExtratorReid:
    def __init__(self) -> None:
        import onnxruntime as ort

        self._sessao = ort.InferenceSession(str(garantir_modelo()), providers=["CPUExecutionProvider"])
        self._entrada = self._sessao.get_inputs()[0].name
        self._lock = threading.Lock()
        self.chamadas = 0

    def descrever(self, quadro_bgr: np.ndarray, caixa) -> np.ndarray | None:
        """Vetor de aparência (512, normalizado) da pessoa na caixa xyxy."""
        altura, largura = quadro_bgr.shape[:2]
        x1, y1, x2, y2 = (int(round(v)) for v in caixa)
        x1, y1, x2, y2 = max(0, x1), max(0, y1), min(largura, x2), min(altura, y2)
        if x2 - x1 < 8 or y2 - y1 < 16:
            return None
        recorte = cv2.resize(quadro_bgr[y1:y2, x1:x2], TAMANHO_ENTRADA, interpolation=cv2.INTER_LINEAR)
        x = cv2.cvtColor(recorte, cv2.COLOR_BGR2RGB).astype(np.float32).transpose(2, 0, 1)[None] / 255.0
        with self._lock:
            vetor = self._sessao.run(None, {self._entrada: x})[0][0]
            self.chamadas += 1
        norma = float(np.linalg.norm(vetor))
        return vetor / norma if norma > 0 else None


def similaridade(vetor: np.ndarray, galeria) -> float:
    """Maior similaridade (cosseno) entre o vetor e a galeria de uma pessoa."""
    return max((float(vetor @ g) for g in galeria), default=-1.0)
