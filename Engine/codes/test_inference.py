import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'           # Suppress TF info/warning logs
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'           # Suppress oneDNN warnings
os.environ['ABSL_MIN_LOG_LEVEL'] = '3'              # Suppress absl warnings

import cv2
import numpy as np
from collections import deque
import argparse
import base64
import sys

# Deep Learning
from tensorflow.keras.models import load_model

# YOLOv8
from ultralytics import YOLO

# DeepSORT Tracking
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
except ImportError:
    print("Error: Please install deep-sort-realtime: pip install deep-sort-realtime")
    exit(1)

def run_inference(video_source, lstm_model_path='models/accident_detection_lstm_model.h5', yolo_weights='yolov8n.pt', output=None):
    """
    Standalone Pipeline: Reads a video file (or camera), extracts moving vehicle features,
    and feeds them sequentially into the pre-trained LSTM to predict Accidents.
    """
    # 1. Check if model exists
    if not os.path.exists(lstm_model_path):
        print(f"Error: Could not find trained model at -> {lstm_model_path}. Please train it first.")
        return
        
    print(f"[INFO] Loading YOLO weights from {yolo_weights}...")
    detector = YOLO(yolo_weights)
    
    print("[INFO] Initializing Deep SORT Tracker...")
    tracker = DeepSort(max_age=30, nn_budget=100)
    
    print(f"[INFO] Loading trained LSTM sequence model from {lstm_model_path}...")
    lstm_model = load_model(lstm_model_path, compile=False)
    
    # Target vehicles (2=car, 3=motorcycle, 5=bus, 7=truck)
    vehicle_classes = [2, 3, 5, 7]
    
    # 2. Open Video Source
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"Error: Could not open video source {video_source}")
        return
        
    # Get video properties for writer
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps != fps:
        fps = 30.0
        
    out_writer = None
    if output:
        ext = str(output).split('.')[-1].lower()
        if ext == 'webm':
            fourcc = cv2.VideoWriter_fourcc(*'VP80')
        elif ext == 'avi':
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
        else:
            fourcc = cv2.VideoWriter_fourcc(*'avc1') # Try H264 for browser MP4
            
        out_writer = cv2.VideoWriter(output, fourcc, fps, (w, h))
        print(f"[INFO] Saving processed video to {output}")
    else:
        print(f"[INFO] Starting inference on {video_source}. Press 'q' to quit.")
    
    # Sequence config matches the LSTM training
    seq_length = 30
    recent_features = deque(maxlen=seq_length)
    FRAME_DIM = 114  # Max 19 boxes * 6 attributes, matches the flattened .npz vector
    last_marker_time = -10.0 # Initialize cooldown timer

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("End of video stream.")
            break
            
        current_time_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        
        # Optional: You can resize for display size, but the neural network expects 224 during actual crop
        # but the tracking coordinates are relative. 
        vis_frame = frame.copy()
        
        # A. YOLO Detection
        results = detector(frame, classes=vehicle_classes, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # Strict Boundary Enforcement
                x1, y1 = max(0, int(x1)), max(0, int(y1))
                x2, y2 = min(frame.shape[1], int(x2)), min(frame.shape[0], int(y2))
                w, h = x2 - x1, y2 - y1
                
                # Valid box check
                if w > 5 and h > 5:
                    detections.append(([x1, y1, w, h], float(box.conf[0]), int(box.cls[0])))
                    
        # B. Multi-Object Tracking
        tracks = tracker.update_tracks(detections, frame=frame)
        
        # C. Feature Extraction (Formatting precisely as [50x114])
        # In the original NPZ: (x1, y1, x2, y2, probability, class) x 19 Max Boxes
        frame_vector = []
        MAX_VEHICLES = 19
        
        tracked_vehicles = [t for t in tracks if t.is_confirmed()]
        # Sort by biggest vehicles first
        tracked_vehicles = sorted(tracked_vehicles, key=lambda t: (t.to_ltrb()[2]-t.to_ltrb()[0])*(t.to_ltrb()[3]-t.to_ltrb()[1]), reverse=True)
        
        for i in range(MAX_VEHICLES):
            if i < len(tracked_vehicles):
                track = tracked_vehicles[i]
                ltrb = track.to_ltrb() # left, top, right, bottom
                frame_vector.extend([ltrb[0], ltrb[1], ltrb[2], ltrb[3], 0.9, 2.0])
                
                # Draw green bounding box around each tracked vehicle
                x1_d, y1_d = int(ltrb[0]), int(ltrb[1])
                x2_d, y2_d = int(ltrb[2]), int(ltrb[3])
                cv2.rectangle(vis_frame, (x1_d, y1_d), (x2_d, y2_d), (0, 255, 0), 2)
                
                # Draw ID label with background
                label = f"ID:{track.track_id}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(vis_frame, (x1_d, y1_d - th - 8), (x1_d + tw + 4, y1_d), (0, 255, 0), -1)
                cv2.putText(vis_frame, label, (x1_d + 2, y1_d - 4), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
            else:
                # Pad to 19 vehicles with zeros
                frame_vector.extend([0, 0, 0, 0, 0, 0])
                
        # Must exactly equal 114
        assert len(frame_vector) == FRAME_DIM
        recent_features.append(frame_vector)
        
        # D. LSTM Neural Network Prediction
        prob = 0.0
        if len(recent_features) == seq_length:
            seq_array = np.array(recent_features).reshape(1, seq_length, FRAME_DIM)
            prob = float(lstm_model.predict(seq_array, verbose=0)[0][0])
        
        # E. Draw the "Accident XX.XX" or "Normal XX.XX" label near the vehicles
        accident_pct = prob * 100
        
        if prob > 0.5:
            banner_text = f"Accident  {accident_pct:.2f}"
            text_color = (0, 255, 255)        # Cyan text
            bg_color = (0, 0, 255)             # Red background
            # Draw thick red border around the whole frame
            cv2.rectangle(vis_frame, (0, 0), (vis_frame.shape[1]-1, vis_frame.shape[0]-1), (0, 0, 255), 4)
            
            # Print marker for Node.js to consume (with 3 second cooldown)
            if current_time_sec - last_marker_time > 3.0:
                print(f"MARKER:{current_time_sec:.1f}:{accident_pct:.1f}", flush=True)
                last_marker_time = current_time_sec
        else:
            banner_text = f"Normal  {100 - accident_pct:.2f}"
            text_color = (0, 255, 0)           # Green text
            bg_color = (0, 100, 0)             # Dark green background
        
        # Position the label at the centroid of all tracked vehicles
        if len(tracked_vehicles) > 0:
            cx_sum, cy_sum = 0, 0
            for t in tracked_vehicles:
                lb = t.to_ltrb()
                cx_sum += (lb[0] + lb[2]) / 2
                cy_sum += (lb[1] + lb[3]) / 2
            label_x = int(cx_sum / len(tracked_vehicles))
            label_y = int(cy_sum / len(tracked_vehicles))
        else:
            # Fallback to center if no vehicles tracked
            label_x = vis_frame.shape[1] // 2
            label_y = vis_frame.shape[0] // 2
        
        # Draw label with background at vehicle centroid
        (tw, th), _ = cv2.getTextSize(banner_text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)
        lx = max(0, label_x - tw // 2)
        ly = max(th + 10, label_y - 20)
        cv2.rectangle(vis_frame, (lx - 5, ly - th - 5), (lx + tw + 5, ly + 5), bg_color, -1)
        cv2.putText(vis_frame, banner_text, (lx, ly),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, text_color, 3, cv2.LINE_AA)
        
        # Show tracked vehicle count
        vehicle_count_text = f"Vehicles Tracked: {len(tracked_vehicles)}"
        cv2.putText(vis_frame, vehicle_count_text, (20, vis_frame.shape[0] - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
                            
        # Write to Output Video if specified, otherwise Display Live
        if out_writer is not None:
            out_writer.write(vis_frame)
            
            # For live streaming to Node.js backend
            # Resize for bandwidth efficiency if width > 640
            stream_frame = vis_frame
            if stream_frame.shape[1] > 640:
                scale = 640.0 / stream_frame.shape[1]
                stream_frame = cv2.resize(stream_frame, (int(stream_frame.shape[1] * scale), int(stream_frame.shape[0] * scale)))
                
            ret_enc, buffer = cv2.imencode('.jpg', stream_frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            if ret_enc:
                b64_str = base64.b64encode(buffer).decode('utf-8')
                print(f"FRAME:{b64_str}")
                sys.stdout.flush()
        else:
            cv2.imshow("Accident Detection Pipeline Inference", vis_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            
    cap.release()
    if out_writer is not None:
        out_writer.release()
    else:
        cv2.destroyAllWindows()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test real-time accident detection on an MP4 or Camera.")
    parser.add_argument("--video", type=str, default=r"c:\Car crash\Videos\Normal\000001.mp4", help="Path to video file or Camera index (e.g. 0)")
    parser.add_argument("--output", type=str, default=None, help="Path to save the output video (e.g. out.mp4). If set, window won't show.")
    default_model = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models', 'accident_detection_lstm_model.h5')
    parser.add_argument("--model", type=str, default=default_model, help="Path to the trained .h5 LSTM network")
    
    args = parser.parse_args()
    
    # Handle camera numerical input
    try:
        video_src = int(args.video)
    except ValueError:
        video_src = args.video
        
    run_inference(video_src, lstm_model_path=args.model, output=args.output)
