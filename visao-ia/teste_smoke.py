"""Teste rápido, sem janela interativa: confirma que YOLO + supervision
funcionam nesta máquina antes de rodar os scripts de webcam ao vivo.
Baixa o modelo YOLOv8n (pessoas/veículos/etc, COCO), roda 1 frame de
uma imagem de amostra e salva anotado em saida_smoke.jpg.
"""

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

print("Carregando YOLOv8n (baixa na primeira vez)...")
model = YOLO("yolov8n.pt")

# Frame de teste sintético (sem precisar de webcam nem internet pra imagem)
frame = np.zeros((480, 640, 3), dtype=np.uint8)
cv2.putText(frame, "Frame de teste", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

print("Rodando detecção...")
result = model(frame, verbose=False)[0]
detections = sv.Detections.from_ultralytics(result)

box_annotator = sv.BoxAnnotator()
label_annotator = sv.LabelAnnotator()
annotated = box_annotator.annotate(scene=frame.copy(), detections=detections)
annotated = label_annotator.annotate(scene=annotated, detections=detections)

cv2.imwrite("saida_smoke.jpg", annotated)

print(f"OK. Detecções no frame de teste: {len(detections)} (esperado 0, é um frame preto)")
print("supervision versão:", sv.__version__)
print("Pipeline funcionando. Arquivo salvo em visao-ia/saida_smoke.jpg")
