"""Detecção + tracking de rosto em tempo real (webcam), com ID
persistente por rosto (ByteTrack) via supervision.

Importante: isto é detecção e rastreio de rosto (onde está um rosto e
"é o mesmo rosto de 2 frames atrás"), não reconhecimento facial (não
identifica QUEM é a pessoa). Reconhecimento de identidade precisa de
um passo a mais (embeddings + cadastro de referência) e, por ser dado
biométrico, exige consentimento LGPD explícito antes de qualquer uso
real (ver PROGRESS.md do projeto).

Uso:
    uv run rosto_tempo_real.py
    uv run rosto_tempo_real.py --source 1   # outra webcam

Pressione "q" na janela pra sair.
"""

import argparse
import time

import cv2
import numpy as np
import mediapipe as mp
import supervision as sv
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions

MODEL_PATH = "models/blaze_face_short_range.tflite"


def detections_do_mediapipe(resultado, largura: int, altura: int) -> sv.Detections:
    if not resultado.detections:
        return sv.Detections.empty()

    xyxy = []
    confidences = []
    for d in resultado.detections:
        bb = d.bounding_box
        x1, y1 = bb.origin_x, bb.origin_y
        x2, y2 = x1 + bb.width, y1 + bb.height
        xyxy.append([x1, y1, x2, y2])
        confidences.append(d.categories[0].score if d.categories else 1.0)

    return sv.Detections(
        xyxy=np.array(xyxy, dtype=np.float32),
        confidence=np.array(confidences, dtype=np.float32),
        class_id=np.zeros(len(xyxy), dtype=int),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="0", help="índice da webcam (padrão: 0)")
    parser.add_argument("--conf", type=float, default=0.5, help="confiança mínima da detecção")
    args = parser.parse_args()

    options = vision.FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        min_detection_confidence=args.conf,
    )
    detector = vision.FaceDetector.create_from_options(options)

    cap = cv2.VideoCapture(int(args.source))
    if not cap.isOpened():
        raise SystemExit(f"Não consegui abrir a webcam de índice {args.source}")

    tracker = sv.ByteTrack()
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()
    trace_annotator = sv.TraceAnnotator()

    inicio = time.monotonic()
    print("Rodando. Pressione 'q' na janela do vídeo pra sair.")
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int((time.monotonic() - inicio) * 1000)

        resultado = detector.detect_for_video(mp_image, timestamp_ms)
        detections = detections_do_mediapipe(resultado, w, h)
        detections = tracker.update_with_detections(detections)

        labels = [f"rosto #{tid}" for tid in detections.tracker_id] if detections.tracker_id is not None else []

        annotated = frame.copy()
        annotated = trace_annotator.annotate(scene=annotated, detections=detections)
        annotated = box_annotator.annotate(scene=annotated, detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)

        cv2.putText(
            annotated,
            f"Rostos rastreados agora: {len(detections)}",
            (10, h - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
        )

        cv2.imshow("Argus - Rastreio de rosto (teste)", annotated)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
