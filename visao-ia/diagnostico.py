"""Diagnóstico de tracking, isolado de idade/gênero de propósito (item
1 do pedido: diagnosticar ANTES de mudar qualquer coisa).

Gera:
  - Um vídeo de saída com o tracker_id (e a confiança) desenhado em
    cada pessoa, pra inspeção visual de onde os IDs trocam.
  - Um relatório (JSON + resumo no terminal) com: total de IDs
    criados, duração de cada track (frames e segundos), histograma de
    duração, e a checagem de FPS informado x processado.

Uso:
    uv run diagnostico.py --source video.mp4
    uv run diagnostico.py --source video.mp4 --preset default --out debug.mp4
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

from config import TrackerConfig
from nucleo import abrir_fonte, criar_tracker, fps_real_da_fonte

BUCKETS_HISTOGRAMA = [
    (0.0, 0.5, "< 0.5s"),
    (0.5, 1.0, "0.5-1s"),
    (1.0, 2.0, "1-2s"),
    (2.0, 5.0, "2-5s"),
    (5.0, 10.0, "5-10s"),
    (10.0, float("inf"), "> 10s"),
]


@dataclass
class RegistroTrack:
    track_id: int
    frame_primeiro: int
    frame_ultimo: int

    def duracao_frames(self) -> int:
        return self.frame_ultimo - self.frame_primeiro + 1


def bucket_de(segundos: float) -> str:
    for lo, hi, label in BUCKETS_HISTOGRAMA:
        if lo <= segundos < hi:
            return label
    return BUCKETS_HISTOGRAMA[-1][2]


def rodar_diagnostico(
    source: str,
    cfg: TrackerConfig,
    out_path: str | None = None,
    max_frames: int | None = None,
) -> dict:
    model = YOLO("yolov8n.pt")
    cap = abrir_fonte(source)
    fps_informado_pelo_arquivo = fps_real_da_fonte(cap)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    tracker = criar_tracker(model, cfg, fps_informado_pelo_arquivo)

    writer = None
    if out_path:
        writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps_informado_pelo_arquivo, (w, h))

    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    tracks: dict[int, RegistroTrack] = {}
    frame_idx = 0
    inicio_wall = time.monotonic()

    while True:
        ok, frame = cap.read()
        if not ok or (max_frames and frame_idx >= max_frames):
            break
        frame_idx += 1

        detections = tracker.update(frame)
        if detections.tracker_id is not None:
            for i, tid in enumerate(detections.tracker_id):
                tid = int(tid)
                if tid not in tracks:
                    tracks[tid] = RegistroTrack(track_id=tid, frame_primeiro=frame_idx, frame_ultimo=frame_idx)
                else:
                    tracks[tid].frame_ultimo = frame_idx

        if writer is not None:
            # nem toda detecção tem tracker_id confirmado ainda (ex.: BoT-SORT
            # só confirma um track depois de alguns frames consecutivos) —
            # o array vem None PRA TODAS as detecções desse frame nesse caso,
            # não por detecção, então o label vira "?" pra manter a contagem
            # de labels igual à de detecções (supervision exige 1 por 1).
            if detections.tracker_id is not None:
                labels = [f"#{tid} {conf:.0%}" for tid, conf in zip(detections.tracker_id, detections.confidence)]
            else:
                labels = ["? (sem ID ainda)" for _ in range(len(detections))]
            annotated = box_annotator.annotate(scene=frame.copy(), detections=detections)
            annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
            cv2.putText(
                annotated,
                f"frame {frame_idx}  IDs ativos: {len(detections)}  IDs totais ate agora: {len(tracks)}",
                (10, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2,
            )
            writer.write(annotated)

    duracao_wall_s = time.monotonic() - inicio_wall
    cap.release()
    if writer is not None:
        writer.release()

    fps_processamento_real = frame_idx / duracao_wall_s if duracao_wall_s > 0 else 0.0

    durações_s = [t.duracao_frames() / fps_informado_pelo_arquivo for t in tracks.values()]
    histograma: dict[str, int] = {label: 0 for _, _, label in BUCKETS_HISTOGRAMA}
    for d in durações_s:
        histograma[bucket_de(d)] += 1

    curtos_1s = sum(1 for d in durações_s if d < 1.0)
    curtos_2s = sum(1 for d in durações_s if d < 2.0)

    relatorio = {
        "fonte": str(source),
        "frames_processados": frame_idx,
        "fps_informado_pelo_arquivo": round(fps_informado_pelo_arquivo, 2),
        "fps_processamento_real": round(fps_processamento_real, 2),
        "obs_fps": (
            "processamento MAIS LENTO que o fps do arquivo: se isso for usado como câmera"
            " ao vivo (não um arquivo em loop), frames vão se acumular/atrasar."
            if fps_processamento_real < fps_informado_pelo_arquivo * 0.9
            else "processamento acompanha o fps do arquivo, sem atraso relevante."
        ),
        "tracker_tipo": cfg.tracker_tipo,
        "total_ids_criados": len(tracks),
        "tracks_com_menos_de_1s": curtos_1s,
        "tracks_com_menos_de_2s": curtos_2s,
        "pct_tracks_curtos_1s": round(100 * curtos_1s / len(tracks), 1) if tracks else 0,
        "pct_tracks_curtos_2s": round(100 * curtos_2s / len(tracks), 1) if tracks else 0,
        "histograma_duracao": histograma,
        "duracoes_por_track": [
            {
                "track_id": t.track_id,
                "frame_inicio": t.frame_primeiro,
                "frame_fim": t.frame_ultimo,
                "duracao_frames": t.duracao_frames(),
                "duracao_s": round(t.duracao_frames() / fps_informado_pelo_arquivo, 2),
            }
            for t in sorted(tracks.values(), key=lambda t: t.frame_primeiro)
        ],
    }
    return relatorio


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--preset", default="default")
    parser.add_argument("--out", default="debug_tracking.mp4", help="vídeo anotado de saída (vazio pra pular)")
    parser.add_argument("--relatorio", default="diagnostico.json")
    parser.add_argument("--max-frames", type=int, default=None)
    args = parser.parse_args()

    cfg = TrackerConfig.carregar(args.preset)
    print(f"Config usada ({args.preset}): tracker={cfg.tracker_tipo}")

    relatorio = rodar_diagnostico(args.source, cfg, out_path=args.out or None, max_frames=args.max_frames)

    Path(args.relatorio).write_text(json.dumps(relatorio, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n=== DIAGNÓSTICO DE TRACKING ===")
    print(f"Fonte: {relatorio['fonte']}")
    print(f"Frames processados: {relatorio['frames_processados']}")
    print(f"FPS informado pelo arquivo: {relatorio['fps_informado_pelo_arquivo']}")
    print(f"FPS real de processamento: {relatorio['fps_processamento_real']}  -> {relatorio['obs_fps']}")
    print(f"Total de IDs criados: {relatorio['total_ids_criados']}")
    print(
        f"Tracks com menos de 1s: {relatorio['tracks_com_menos_de_1s']} "
        f"({relatorio['pct_tracks_curtos_1s']}%)  |  menos de 2s: {relatorio['tracks_com_menos_de_2s']} "
        f"({relatorio['pct_tracks_curtos_2s']}%)"
    )
    print("\nHistograma de duração dos tracks:")
    for _, _, label in BUCKETS_HISTOGRAMA:
        n = relatorio["histograma_duracao"][label]
        print(f"  {label:>8}: {'#' * n} ({n})")
    print(f"\nRelatório completo salvo em {args.relatorio}")
    if args.out:
        print(f"Vídeo anotado salvo em {args.out}")


if __name__ == "__main__":
    main()
