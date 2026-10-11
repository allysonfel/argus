import time
import cv2
import numpy as np
import mediapipe as mp
import supervision as sv
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions
from ultralytics import YOLO

print("Abrindo webcam...")
cap = cv2.VideoCapture(0)
ok, frame = cap.read()
cap.release()
if not ok:
    raise SystemExit("Não consegui capturar frame da webcam (permissão de câmera negada ao terminal?)")
print("Frame capturado:", frame.shape)
cv2.imwrite("saida_webcam_frame.jpg", frame)

print("\n--- Testando pipeline de pessoas (YOLO + ByteTrack) ---")
model = YOLO("yolov8n.pt")
result = model(frame, verbose=False, classes=[0], conf=0.35)[0]
det = sv.Detections.from_ultralytics(result)
tracker = sv.ByteTrack()
det = tracker.update_with_detections(det)
print("Pessoas detectadas no frame:", len(det))

print("\n--- Testando pipeline de rosto (mediapipe + ByteTrack) ---")
options = vision.FaceDetectorOptions(
    base_options=BaseOptions(model_asset_path="models/blaze_face_short_range.tflite"),
    running_mode=vision.RunningMode.VIDEO,
    min_detection_confidence=0.5,
)
detector = vision.FaceDetector.create_from_options(options)
rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
resultado = detector.detect_for_video(mp_image, 0)
print("Rostos detectados no frame:", len(resultado.detections) if resultado.detections else 0)

print("\nOK. Os dois pipelines rodaram sem erro. Frame salvo em saida_webcam_frame.jpg")
