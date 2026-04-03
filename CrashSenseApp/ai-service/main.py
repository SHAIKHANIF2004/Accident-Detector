from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from simulator import get_detection

app = FastAPI(
    title="CrashSense AI Detection Service",
    description="Simulated YOLO + LSTM accident detection microservice",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"service": "CrashSense AI Detection", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-detection"}

@app.get("/detect/{camera_id}")
def detect(camera_id: str):
    """Get simulated accident detection for a camera."""
    return get_detection(camera_id)
