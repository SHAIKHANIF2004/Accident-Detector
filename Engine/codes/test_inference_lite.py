import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
# --- CRITICAL: CPU Performance limits for Render Free Tier ---
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
# -----------------------------------------------------------
import cv2
import numpy as np
from collections import deque
import argparse
import sys
import base64
import gc
import torch

# Deep learning thread management
torch.set_num_threads(1)
torch.set_grad_enabled(False)

# Lightweight Inference Engines
import onnxruntime as ort
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

# Get absolute path of current script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# ── Robust Accuracy Configuration ──
MAX_FRAME_WIDTH = 480    # Reduced from 640 to 480 for 512MB RAM constraint
YOLO_IMGSZ = 256         # Reduced from 320 for speed and lower RAM
DEEPSORT_BUDGET = 15     # Reduced from 30 to save tracking memory
LIVE_PREVIEW_EVERY = 30  # Less frequent base64 emission to save node.js memory

def run_inference(video_source, lstm_onnx_path=None, yolo_weights=None, output=None):
    if lstm_onnx_path is None:
        lstm_onnx_path = os.path.join(script_dir, '..', 'models', 'accident_detection_lstm_model.onnx')
    if yolo_weights is None:
        yolo_weights = os.path.join(script_dir, 'yolov8n.pt')
        
    # Standardize paths
    lstm_onnx_path = os.path.abspath(lstm_onnx_path)
    yolo_weights = os.path.abspath(yolo_weights)
    
    if not os.path.exists(lstm_onnx_path) or not os.path.exists(yolo_weights):
        print(f"Error: Missing model files at:\n{lstm_onnx_path}\n{yolo_weights}", flush=True)
        sys.exit(1)
        
    # Load YOLO
    detector = YOLO(yolo_weights)
    
    # Initialize Tracker
    tracker = DeepSort(max_age=30, nn_budget=DEEPSORT_BUDGET)
    
    # Initialize ONNX with single-thread CPU optimization (CRITICAL FOR 512MB)
    sess_options = ort.SessionOptions()
    sess_options.intra_op_num_threads = 1
    sess_options.inter_op_num_threads = 1
    sess_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    # Render free tier optimization - prevent memory arena growing infinitely
    sess_options.enable_cpu_mem_arena = False 
    
    ort_session = ort.InferenceSession(lstm_onnx_path, sess_options, providers=['CPUExecutionProvider'])
    input_name = ort_session.get_inputs()[0].name
    seq_length = 50
    
    vehicle_classes = [2, 3, 5, 7] # car, motorcycle, bus, truck
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print("Error: Could not open video source.", flush=True)
        sys.exit(1)
        
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    # Scaling logic
    scale = MAX_FRAME_WIDTH / orig_w if orig_w > MAX_FRAME_WIDTH else 1.0
    proc_w = int(orig_w * scale)
    proc_h = int(orig_h * scale)
        
    out_writer = None
    if output:
        # We always output at proc_w/proc_h (standard 640px range)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v') # Reliable fallback
        out_writer = cv2.VideoWriter(output, fourcc, fps, (proc_w, proc_h))
    
    recent_features = deque(maxlen=seq_length)
    last_marker_time = -10.0
    frame_count = 0
    
    print(f"[INFO] Analysis started (Res: {proc_w}x{proc_h}, FPS: {fps:.1f})", flush=True)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        frame_count += 1
        current_time_sec = frame_count / fps
        
        # Resize frame
        if scale != 1.0:
            frame = cv2.resize(frame, (proc_w, proc_h))
        
        vis_frame = frame.copy()
        
        # 1. Detection
        results = detector(frame, classes=vehicle_classes, verbose=False, imgsz=YOLO_IMGSZ)
        detections = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                detections.append(([x1, y1, x2-x1, y2-y1], conf, cls))
        
        # 2. Tracking
        tracks = tracker.update_tracks(detections, frame=frame)
        
        # 3. Feature extraction for LSTM (Top 19 vehicles)
        # --- CRITICAL: NORMALIZE COORDINATES TO 0-1 RANGE ---
        # The LSTM model expects consistent input regardless of frame size.
        tracked_vehicles = [t for t in tracks if t.is_confirmed()]
        # Sort by box area to prioritize closest vehicles
        tracked_vehicles = sorted(tracked_vehicles, key=lambda t: (t.to_ltrb()[2]-t.to_ltrb()[0])*(t.to_ltrb()[3]-t.to_ltrb()[1]), reverse=True)
        
        current_frame_features = []
        for i in range(19): # MAX_VEHICLES = 19
            if i < len(tracked_vehicles):
                track = tracked_vehicles[i]
                ltrb = track.to_ltrb()
                # Store normalized coordinates
                nx1 = ltrb[0] / proc_w
                ny1 = ltrb[1] / proc_h
                nx2 = ltrb[2] / proc_w
                ny2 = ltrb[3] / proc_h
                # We use the same feature format: [x1, y1, x2, y2, confidence, class]
                current_frame_features.extend([nx1, ny1, nx2, ny2, 0.9, 2.0])
                
                # Draw for visualization
                cv2.rectangle(vis_frame, (int(ltrb[0]), int(ltrb[1])), (int(ltrb[2]), int(ltrb[3])), (0, 255, 0), 1)
            else:
                current_frame_features.extend([0.0] * 6)
                
        recent_features.append(current_frame_features)
        
        # 4. Accident Detection (LSTM)
        prob = 0.0
        if len(recent_features) == seq_length:
            input_data = np.array([recent_features], dtype=np.float32)
            outputs = ort_session.run(None, {input_name: input_data})
            prob = float(outputs[0][0][0])
            
        accident_pct = prob * 100
        
        if prob > 0.6: # Higher threshold to reduce false positives
            banner_text = f"ACCIDENT DETECTED ({accident_pct:.0f}%)"
            color = (0, 0, 255)
            cv2.rectangle(vis_frame, (0, 0), (proc_w-1, proc_h-1), color, 3)
            
            if current_time_sec - last_marker_time > 3.0:
                print(f"MARKER:{current_time_sec:.1f}:{accident_pct:.1f}:vehicle", flush=True)
                last_marker_time = current_time_sec
        else:
            banner_text = f"Status: Normal ({100 - accident_pct:.0f}%)"
            color = (0, 255, 0)
        
        cv2.putText(vis_frame, banner_text, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        # Base64 preview for socket
        if frame_count % LIVE_PREVIEW_EVERY == 0:
            _, buffer = cv2.imencode('.jpg', vis_frame, [cv2.IMWRITE_JPEG_QUALITY, 40])
            print(f"FRAME:{base64.b64encode(buffer).decode('utf-8')}", flush=True)
            sys.stdout.flush()
        
        if out_writer:
            out_writer.write(vis_frame)
        
        # AGGRESSIVE GARBAGE COLLECTION for 512MB limit
        if frame_count % 30 == 0:
            gc.collect()

    cap.release()
    if out_writer: out_writer.release()
    print("[INFO] Analysis complete.", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=str, required=True)
    parser.add_argument('--output', type=str)
    args = parser.parse_args()
    run_inference(args.video, output=args.output)
