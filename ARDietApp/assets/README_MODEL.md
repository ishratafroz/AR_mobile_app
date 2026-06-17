# On-device RAW produce classifier (assets/produce.tflite) — NOT yet supplied

The SCAN pipeline's dish classifier (`aiy_food_V1.tflite`) only knows **prepared
dishes** (Apple pie, Banana split, Grape pie…) — it has **no bare-fruit classes**.
The SSD box detector (`food_detect.tflite`) knows only 4 fruits. So raw produce
(pear, kiwi, tomato, strawberry, mango…) is the on-device blind spot.

`LocalProduceClassifier.js` is wired and ready; it just needs a model file. Until
you add one it stays **disabled** and SCAN behaves exactly as before (no crash).

## Get a produce model (any one works)
A simple route is the Kaggle **"Fruits and Vegetables Image Recognition"** dataset
(36 classes), trained with TF Model Maker / Keras and exported to TFLite:

```python
# pip install tflite-model-maker  (or use Keras + converter)
# Train an image classifier on the 36-class fruits/vegetables folders, then:
model.export(export_dir='.', tflite_filename='produce.tflite')
```

The default labels in `src/data/ProduceLabels.js` already match that 36-class set
(alphabetical — TF's default index order). Any other model is fine too; just edit
`ProduceLabels.js` so the names/order match your model's output classes.

## Activate (2 steps, no native rebuild)
1. Copy your file to `ARDietApp/assets/produce.tflite`
2. In `src/services/produceModelSource.js`, change the last line to:
   ```js
   export default require('../../assets/produce.tflite');
   ```
Then restart Metro (`npx react-native start --reset-cache`) and reload.

## Model contract expected by LocalProduceClassifier.js
- Input:  `[1, S, S, 3]` (S read from the model; 224 typical), uint8 `[0,255]` or
  float32 `[0,1]` (auto-detected). RGB, NHWC.
- Output: `[1, N]` class probabilities, N == `PRODUCE_LABELS.length`. uint8 or
  float32 (auto-detected).

---

# On-device YOLO model

The app runs food detection **fully on-device** (no image ever leaves the phone) using a
YOLOv8 TFLite model loaded from `assets/yolov8n_float32.tflite`.

The file currently here is a **placeholder**. Replace it with a real export:

## One-time export (on any machine with Python)

```bash
pip install ultralytics
# downloads yolov8n.pt (COCO) and exports a float32 TFLite model
yolo export model=yolov8n.pt format=tflite imgsz=640
```

This produces `yolov8n_saved_model/yolov8n_float32.tflite`.
Copy it over the placeholder:

```
ARDietApp/assets/yolov8n_float32.tflite
```

Then in the app: restart Metro (`npx react-native start --reset-cache`) and reload —
no native rebuild needed (debug JS + assets come from Metro).

## What COCO YOLOv8 detects (food classes)
banana, apple, orange, sandwich, broccoli, carrot, hot dog, pizza, donut, cake.

Good enough for fruit/common-food demos and **100% offline**. For broader coverage,
fine-tune YOLOv8 on a food dataset (e.g., Roboflow food sets) and export the same way —
just keep the output filename `yolov8n_float32.tflite` (or update the path in
`src/services/LocalFoodDetector.js`).

## Model contract expected by LocalFoodDetector.js
- Input:  `[1, 640, 640, 3]` float32, RGB, normalized 0..1 (NHWC — TFLite default)
- Output: `[1, 84, 8400]` float32 (4 box coords + 80 class scores, channel-major)
If you export a different size, update `INPUT_SIZE` in LocalFoodDetector.js.
