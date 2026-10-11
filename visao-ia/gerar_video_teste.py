"""Gera um vídeo sintético com contagem de pessoas CONHECIDA (ground
truth), recortando pessoas reais das imagens de exemplo da ultralytics
(zidane.jpg, bus.jpg — têm gente de verdade, YOLO detecta normalmente)
e animando esses recortes cruzando o quadro, com uma oclusão proposital
no meio do caminho pra estressar o tracker.

Isso é só um fixture de teste interno, enquanto o vídeo real do
shopping não chega. Serve pra validar o pipeline (diagnostico.py,
validacao.py) com verdade fundamental exata, não pra tirar conclusão
nenhuma sobre o ambiente real do cliente.

Uso:
    uv run gerar_video_teste.py --pessoas 6 --out teste_ground_truth.mp4
"""

import argparse

import cv2
import numpy as np
from ultralytics import YOLO
from ultralytics.utils import ASSETS


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return inter / min(area_a, area_b) if min(area_a, area_b) > 0 else 0.0


def extrair_recortes_de_pessoas() -> list[np.ndarray]:
    """Só usa recortes de pessoas ISOLADAS (caixa não sobrepõe a caixa de
    nenhuma outra pessoa detectada na mesma foto). zidane.jpg tem 2
    pessoas bem coladas (as caixas se sobrepõem bastante) — usar esse
    recorte como "1 pessoa sintética" faria o YOLO detectar 2 pessoas
    dentro dele de verdade, inflando o ground truth por engano (foi
    exatamente isso que causou o "8 tracks pra 6 pessoas" da rodada
    anterior — não era bug de tracking, era bug deste gerador)."""
    model = YOLO("yolov8n.pt")
    recortes = []
    for nome_img in ["zidane.jpg", "bus.jpg"]:
        img = cv2.imread(str(ASSETS / nome_img))
        result = model(img, verbose=False, classes=[0], conf=0.4)[0]
        boxes = result.boxes.xyxy.cpu().numpy()
        for i, (x1, y1, x2, y2) in enumerate(boxes.astype(int)):
            # 0.35: exclui pares tipo zidane.jpg (71% de sobreposição,
            # praticamente a mesma caixa) mas mantém gente só "próxima"
            # tipo bus.jpg (19% de sobreposição, pessoas distintas).
            sobrepoe_outra = any(_iou(boxes[i], boxes[j]) > 0.35 for j in range(len(boxes)) if j != i)
            if sobrepoe_outra:
                continue
            recorte = img[y1:y2, x1:x2]
            if recorte.shape[0] > 40 and recorte.shape[1] > 20:
                recortes.append(recorte)
    return recortes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pessoas", type=int, default=6, help="quantas pessoas distintas gerar (ground truth)")
    parser.add_argument("--out", default="teste_ground_truth.mp4")
    parser.add_argument("--fps", type=int, default=20)
    parser.add_argument("--largura", type=int, default=960)
    parser.add_argument("--altura", type=int, default=540)
    parser.add_argument("--duracao_s", type=int, default=25)
    parser.add_argument("--com_oclusao", action="store_true", default=True)
    args = parser.parse_args()

    print("Extraindo recortes de pessoas reais (zidane.jpg, bus.jpg)...")
    recortes_base = extrair_recortes_de_pessoas()
    if len(recortes_base) < 2:
        raise SystemExit("Não consegui extrair pessoas suficientes das imagens de exemplo.")
    print(f"{len(recortes_base)} recortes de pessoa disponíveis.")

    altura_pessoa = 220
    pessoas = []
    rng = np.random.default_rng(42)
    for i in range(args.pessoas):
        base = recortes_base[i % len(recortes_base)]
        escala = altura_pessoa / base.shape[0]
        largura_pessoa = int(base.shape[1] * escala)
        recorte = cv2.resize(base, (largura_pessoa, altura_pessoa))
        y = rng.integers(40, args.altura - altura_pessoa - 40)
        direcao = 1 if i % 2 == 0 else -1
        velocidade = rng.uniform(2.2, 3.4)
        atraso_frames = i * rng.integers(8, 20)
        pessoas.append(
            {
                "recorte": recorte,
                "y": int(y),
                "x": -largura_pessoa if direcao == 1 else args.largura,
                "direcao": direcao,
                "velocidade": velocidade,
                "atraso": atraso_frames,
                "largura": largura_pessoa,
            }
        )

    total_frames = args.fps * args.duracao_s
    writer = cv2.VideoWriter(args.out, cv2.VideoWriter_fourcc(*"mp4v"), args.fps, (args.largura, args.altura))

    print(f"Gerando {total_frames} frames ({args.duracao_s}s a {args.fps}fps)...")
    for frame_idx in range(total_frames):
        frame = np.full((args.altura, args.largura, 3), (60, 60, 62), dtype=np.uint8)

        for p in pessoas:
            if frame_idx < p["atraso"]:
                continue
            p["x"] += p["direcao"] * p["velocidade"]
            x = int(p["x"])
            recorte = p["recorte"]
            h, w = recorte.shape[:2]
            x0, y0 = x, p["y"]
            x1, y1 = x0 + w, y0 + h
            fx0, fy0 = max(0, x0), max(0, y0)
            fx1, fy1 = min(args.largura, x1), min(args.altura, y1)
            if fx1 <= fx0 or fy1 <= fy0:
                continue
            rx0, ry0 = fx0 - x0, fy0 - y0
            rx1, ry1 = rx0 + (fx1 - fx0), ry0 + (fy1 - fy0)
            frame[fy0:fy1, fx0:fx1] = recorte[ry0:ry1, rx0:rx1]

        # Oclusão proposital: uma "coluna" opaca DEPOIS de desenhar todo
        # mundo, pra realmente esconder quem estiver atrás (testa se o
        # tracker segura o ID durante isso). Antes esta coluna era
        # desenhada ANTES das pessoas e ficava sempre por baixo, então
        # nunca escondia ninguém de verdade.
        if args.com_oclusao:
            cx = args.largura // 2
            cv2.rectangle(frame, (cx - 25, 0), (cx + 25, args.altura), (30, 30, 30), -1)

        writer.write(frame)

    writer.release()
    print(f"Vídeo salvo em {args.out}")
    print(f"GROUND TRUTH: {args.pessoas} pessoas distintas cruzaram o quadro.")


if __name__ == "__main__":
    main()
