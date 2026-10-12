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
COPY casos ./casos
# Os vídeos dos casos (H.264, 15 fps) servem também de fonte das câmeras
# ao vivo: o upload leva só os que não estão em casos/videos.
RUN mkdir -p uploads/demo && cp -n casos/videos/*.mp4 uploads/demo/ 2>/dev/null || true

# Baixa os pesos do rfdetr-nano agora, não no primeiro boot
RUN python -c "import rfdetr; rfdetr.RFDETRNano(device='cpu')"

# config.py acha config/, presets/ e vídeos a partir de src/, então o
# código roda de /app/src (e não da cópia instalada em site-packages)
ENV PYTHONPATH=/app/src
ENV PORT=8500
# Threads do torch/OpenMP: o contêiner enxerga todos os núcleos do host
ENV OMP_NUM_THREADS=4 MKL_NUM_THREADS=4
# CPU do servidor é mais lenta que a de desenvolvimento: as câmeras que
# ninguém está assistindo analisam a cada 10 s, sobrando o detector para a
# câmera aberta no painel (com intervalos longos o rastreio perde as pessoas)
ENV ARGUS_FPS_SEM_ESPECTADOR=0.1
CMD ["sh", "-c", "uvicorn argus_visao.api:app --host 0.0.0.0 --port ${PORT}"]
