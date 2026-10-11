"""Diagnóstico de tracking de um vídeo: gera um vídeo de saída com o
tracker_id desenhado em cada pessoa (pra ver onde os IDs trocam) e um
relatório com a duração de cada track.

Uso (de dentro de visao-ia/):
    uv run diagnostico.py videos/corredor.mp4
    uv run diagnostico.py videos/corredor.mp4 --preset default --fps 4 --saida debug/corredor.mp4
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import supervision as sv

from argus_visao.config import TrackerConfig
from argus_visao.offline import detectar_video, histograma_duracoes, rodar


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("video", type=Path)
    p.add_argument("--preset", default="default")
    p.add_argument("--fps", type=float, default=4.0, help="fps de análise (padrão 4, igual ao motor ao vivo)")
    p.add_argument("--saida", type=Path, help="vídeo de debug (padrão: debug/<nome>.mp4)")
    args = p.parse_args()

    cfg = TrackerConfig.carregar(args.preset)
    saida = args.saida or Path("debug") / f"{args.video.stem}-{cfg.nome}.mp4"
    saida.parent.mkdir(parents=True, exist_ok=True)

    quadros, tamanho = detectar_video(args.video, args.fps)
    por_indice: dict[int, sv.Detections] = {}
    relatorio = rodar(quadros, tamanho, cfg, args.fps, ao_rastrear=lambda q, r: por_indice.__setitem__(q.indice, r))

    # Vídeo de debug: só os quadros analisados, gravado no fps de análise
    # (toca em tempo real) com ID + confiança em cada pessoa.
    caixa = sv.BoxAnnotator(thickness=2)
    rotulo = sv.LabelAnnotator(text_scale=0.6, text_padding=4)
    rastro = sv.TraceAnnotator(trace_length=int(args.fps * 4))
    escritor = cv2.VideoWriter(str(saida), cv2.VideoWriter_fourcc(*"mp4v"), args.fps, tamanho)
    cap = cv2.VideoCapture(str(args.video))
    indice = 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        if indice in por_indice:
            d = por_indice[indice]
            textos = [f"#{t} {c:.2f}" for t, c in zip(d.tracker_id, d.confidence)] if len(d) else []
            img = rastro.annotate(img, d)
            img = caixa.annotate(img, d)
            img = rotulo.annotate(img, d, labels=textos)
            cv2.putText(img, f"t={indice / (cap.get(cv2.CAP_PROP_FPS) or 25):.1f}s  pessoas={len(d)}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            escritor.write(img)
        indice += 1
    cap.release()
    escritor.release()

    duracoes = relatorio["duracoes_s"]
    print(f"\n=== Diagnóstico: {args.video.name} (preset '{cfg.nome}', {args.fps} fps de análise)")
    print(f"IDs criados no total:            {relatorio['ids_criados']}")
    print(f"Visitantes únicos (estimativa):  {relatorio['visitantes_unicos_estimado']}  (tracks >= {cfg.min_track_duration_s}s)")
    print("Duração dos tracks:")
    for faixa, n in histograma_duracoes(duracoes).items():
        print(f"  {faixa:>8}: {'#' * n} {n}")
    print(f"Vídeo de debug: {saida}")

    json_saida = saida.with_suffix(".json")
    json_saida.write_text(json.dumps({"video": str(args.video), "preset": cfg.nome, "fps_analise": args.fps, **relatorio}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Relatório:      {json_saida}")


if __name__ == "__main__":
    main()
