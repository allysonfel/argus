"""Tráfego de pessoas em tempo real: detecção (YOLOv8n) + tracking
persistente (ByteTrack) + contagem de cruzamento de linha + zona
restrita com alerta, igual ao que o módulo "Câmeras IA" do Argus
promete (detectar pessoa numa área restrita e avisar).

Uso:
    uv run trafego_pessoas.py                # webcam (índice 0)
    uv run trafego_pessoas.py --source video.mp4
    uv run trafego_pessoas.py --source 1     # outra webcam

Pressione "q" na janela pra sair.
"""

import argparse

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

PERSON_CLASS_ID = 0  # COCO: 0 = person


def abrir_fonte(source: str) -> cv2.VideoCapture:
    # Índice numérico -> webcam; qualquer outra coisa -> caminho de arquivo/RTSP
    cam_index = int(source) if source.isdigit() else None
    cap = cv2.VideoCapture(cam_index if cam_index is not None else source)
    if not cap.isOpened():
        raise SystemExit(f"Não consegui abrir a fonte de vídeo: {source}")
    return cap


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="0", help="0 = webcam padrão, ou caminho de vídeo/RTSP")
    parser.add_argument("--conf", type=float, default=0.35, help="confiança mínima da detecção")
    args = parser.parse_args()

    print("Carregando YOLOv8n...")
    model = YOLO("yolov8n.pt")

    cap = abrir_fonte(args.source)
    ok, frame = cap.read()
    if not ok:
        raise SystemExit("Não consegui ler o primeiro frame da fonte de vídeo.")
    h, w = frame.shape[:2]

    # Linha de contagem no meio da tela (cruzou pra cima = OUT, pra baixo = IN)
    line_zone = sv.LineZone(start=sv.Point(0, h // 2), end=sv.Point(w, h // 2))
    line_annotator = sv.LineZoneAnnotator(thickness=2, text_scale=0.6)

    # "Área restrita" de exemplo: quadrante superior direito da tela
    zona_restrita = np.array(
        [[int(w * 0.55), 0], [w, 0], [w, int(h * 0.45)], [int(w * 0.55), int(h * 0.45)]]
    )
    polygon_zone = sv.PolygonZone(polygon=zona_restrita)
    polygon_annotator = sv.PolygonZoneAnnotator(zone=polygon_zone, color=sv.Color.RED, thickness=2)

    tracker = sv.ByteTrack()
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()
    trace_annotator = sv.TraceAnnotator()

    pessoas_na_zona_restrita: set[int] = set()

    print("Rodando. Pressione 'q' na janela do vídeo pra sair.")
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        result = model(frame, verbose=False, classes=[PERSON_CLASS_ID], conf=args.conf)[0]
        detections = sv.Detections.from_ultralytics(result)
        detections = tracker.update_with_detections(detections)

        line_zone.trigger(detections)
        na_zona = polygon_zone.trigger(detections)

        # Alerta simples no terminal quando um ID novo entra na área restrita
        if detections.tracker_id is not None:
            for tid, dentro in zip(detections.tracker_id, na_zona):
                if dentro and tid not in pessoas_na_zona_restrita:
                    pessoas_na_zona_restrita.add(tid)
                    print(f"[ALERTA] Pessoa #{tid} entrou na área restrita")
                elif not dentro and tid in pessoas_na_zona_restrita:
                    pessoas_na_zona_restrita.discard(tid)

        labels = [
            f"#{tid} pessoa {conf:.0%}"
            for tid, conf in zip(detections.tracker_id, detections.confidence)
        ]

        annotated = frame.copy()
        annotated = polygon_annotator.annotate(scene=annotated)
        annotated = trace_annotator.annotate(scene=annotated, detections=detections)
        annotated = box_annotator.annotate(scene=annotated, detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
        annotated = line_annotator.annotate(frame=annotated, line_counter=line_zone)

        cv2.putText(
            annotated,
            f"Na area restrita agora: {len(pessoas_na_zona_restrita)}",
            (10, h - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 255),
            2,
        )

        cv2.imshow("Argus - Trafego de pessoas (teste)", annotated)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
