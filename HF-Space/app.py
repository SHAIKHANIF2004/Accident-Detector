from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import tempfile
import os
import json
import shutil
from ultralytics import YOLO

app = FastAPI(title="CrashSense AI Engine")

# Needs to allow CORS so your Render app can talk to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the YOLO model (Assumes best.pt is placed in the same folder in HuggingFace)
model = None

def load_model():
    global model
    if model is None:
        model_path = os.environ.get("MODEL_PATH", "best.pt")
        print(f"Loading YOLO model from {model_path}...")
        try:
            model = YOLO(model_path)
            # Use smaller resolution if memory constrained
            model.conf = 0.5 
        except Exception as e:
            print(f"Failed to load model: {e}")

@app.on_event("startup")
async def startup_event():
    load_model()

@app.get("/")
def health_check():
    return {"status": "online", "model_loaded": model is not None}

@app.post("/analyze")
async def analyze_video(video: UploadFile = File(...)):
    if model is None:
        return {"error": "Model not loaded properly on HuggingFace Space"}

    # Save uploaded video to temp file
    input_fd, input_path = tempfile.mkstemp(suffix=".mp4")
    with os.fdopen(input_fd, "wb") as f:
        content = await video.read()
        f.write(content)
        
    output_path = input_path.replace(".mp4", "_annotated.mp4")
    
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return {"error": "Could not open video file"}

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps != fps:
        fps = 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # We must use 'mp4v' or 'x264' depending on cv2 availability. mp4v is standard.
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    markers = []
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        current_time_sec = frame_count / fps

        # Perform Inference
        results = model(frame, verbose=False)[0]
        
        # We assume single class (accident) or standard YOLO 80 classes. 
        # For CrashSense, if bounding box exists, we consider it an accident frame.
        boxes = results.boxes
        if len(boxes) > 0:
            # We record a marker for this second if we haven't already
            if len(markers) == 0 or (current_time_sec - markers[-1]['time'] > 1.0):
                max_conf = float(boxes.conf.max().cpu().numpy()) * 100
                markers.append({
                    "time": round(current_time_sec),
                    "confidence": round(max_conf),
                    "objects": ["accident_detected"]
                })

        # Draw bounding boxes
        annotated_frame = results.plot()
        out.write(annotated_frame)

    cap.release()
    out.release()
    
    # Save markers to a dictionary instead of zip
    video_id = os.path.basename(output_path).replace('.mp4', '')
    
    # Store locally for the download endpoint
    try:
        os.remove(input_path) # cleanup original
    except: pass
    
    # Send response back with JSON data
    return {"markers": markers, "video_id": video_id}

@app.get("/download/{video_id}")
async def download_video(video_id: str):
    file_path = os.path.join(tempfile.gettempdir(), f"{video_id}.mp4")
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4", filename="annotated.mp4")
    return {"error": "File not found or expired"}

