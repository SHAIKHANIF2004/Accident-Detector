import tensorflow as tf
import os
import subprocess
import shutil

# This version saves the model as a SavedModel first, then converts via CLI.
# This is the most compatible way to handle Keras 3 / TensorFlow 2.16+.

base_dir = os.path.dirname(__file__)
model_path = os.path.join(base_dir, '..', 'models', 'accident_detection_lstm_model.h5')
temp_saved_model = os.path.join(base_dir, '..', 'models', 'temp_saved_model')
output_onnx_path = os.path.join(base_dir, '..', 'models', 'accident_detection_lstm_model.onnx')

if not os.path.exists(model_path):
    print(f"Error: Model not found at {model_path}")
    exit(1)

print("1. Loading heavy model and exporting to SavedModel...")
model = tf.keras.models.load_model(model_path, compile=False)
# Keras 3 requires .export() for SavedModel format
if hasattr(model, 'export'):
    model.export(temp_saved_model)
else:
    model.save(temp_saved_model, save_format='tf')

print("2. Converting to ONNX using CLI...")
try:
    # We call the tf2onnx module directly as a process
    subprocess.run([
        "python", "-m", "tf2onnx.convert",
        "--saved-model", temp_saved_model,
        "--output", output_onnx_path,
        "--opset", "13"
    ], check=True)
    print(f"\n✅ Success! Lightweight model saved to: {output_onnx_path}")
except Exception as e:
    print(f"\n❌ Conversion failed: {e}")
finally:
    # Clean up the temporary folder
    if os.path.exists(temp_saved_model):
        shutil.rmtree(temp_saved_model)

print("Now push this .onnx file to your GitHub repository.")
