# Motor de visão para o Railway (serviço "visao-ia" no projeto argus).
# Só CPU: torch vem do índice CPU do PyTorch para a imagem não carregar
# as bibliotecas CUDA (vários GB). Pesos do modelo baixados no build.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

COPY config ./config
COPY presets ./presets
COPY videos ./videos
COPY uploads ./uploads

# Baixa os pesos do rfdetr-nano agora, não no primeiro boot
RUN python -c "import rfdetr; rfdetr.RFDETRNano(device='cpu')"

# config.py acha config/, presets/ e vídeos a partir de src/, então o
# código roda de /app/src (e não da cópia instalada em site-packages)
ENV PYTHONPATH=/app/src
ENV PORT=8500
# Threads do torch/OpenMP: o contêiner enxerga todos os núcleos do host
ENV OMP_NUM_THREADS=4 MKL_NUM_THREADS=4
CMD ["sh", "-c", "uvicorn argus_visao.api:app --host 0.0.0.0 --port ${PORT}"]
