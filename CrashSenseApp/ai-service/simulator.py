import random
import time
from datetime import datetime

VEHICLE_TYPES = ["car", "truck", "motorcycle", "bus", "van", "suv"]

# Camera state tracking for more realistic simulation
_camera_states = {}

def get_detection(camera_id: str) -> dict:
    """
    Generate simulated YOLO + LSTM detection output.
    Most of the time returns low probability (normal traffic).
    Occasionally spikes to high probability (accident detected).
    Uses per-camera state to create realistic multi-frame accident events.
    """
    state = _camera_states.get(camera_id, {"accident_frames": 0, "cooldown": 0})

    # If in cooldown after an accident event, gradually decrease
    if state["cooldown"] > 0:
        state["cooldown"] -= 1
        probability = random.uniform(5, 25)
    elif state["accident_frames"] > 0:
        # Continue accident event for several frames
        state["accident_frames"] -= 1
        probability = random.uniform(78, 98)
    else:
        # Normal operation: ~8% chance of starting an accident event
        if random.random() < 0.08:
            state["accident_frames"] = random.randint(2, 5)
            state["cooldown"] = random.randint(8, 15)
            probability = random.uniform(82, 97)
        else:
            probability = random.uniform(3, 35)

    _camera_states[camera_id] = state

    # Generate detected objects
    num_objects = random.randint(1, 4)
    detected_objects = random.sample(VEHICLE_TYPES, min(num_objects, len(VEHICLE_TYPES)))

    return {
        "cameraId": camera_id,
        "accidentProbability": round(probability, 2),
        "detectedObjects": detected_objects,
        "timestamp": datetime.now().isoformat(),
        "frameId": int(time.time() * 1000) % 100000
    }
