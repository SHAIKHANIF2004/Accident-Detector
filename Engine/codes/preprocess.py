import cv2
import sys
import os

def transcode_video(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: Input file {input_path} not found.")
        sys.exit(1)

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {input_path}")
        sys.exit(1)

    # Get properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps != fps:
        fps = 30.0

    # Try codecs in order of browser compatibility
    # avc1 (H.264) is best for web but needs OpenH264 on some systems
    # mp4v is universally available in OpenCV
    out = None
    for codec in ['avc1', 'mp4v']:
        fourcc = cv2.VideoWriter_fourcc(*codec)
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if out.isOpened():
            print(f"Using codec: {codec}", flush=True)
            break
        out.release()
        out = None

    if out is None:
        print("Error: Could not initialize any video codec.", flush=True)
        sys.exit(1)

    print(f"Transcoding {input_path} to {output_path}...", flush=True)
    
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        out.write(frame)
        frame_count += 1
        if frame_count % 100 == 0:
            print(f"Processed {frame_count} frames...", flush=True)

    cap.release()
    out.release()
    print("Transcoding complete successfully.", flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python preprocess.py <input_path> <output_path>")
        sys.exit(1)
    
    transcode_video(sys.argv[1], sys.argv[2])
