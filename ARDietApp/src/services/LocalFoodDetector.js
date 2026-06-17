// Fully on-device food detection — the camera image NEVER leaves the phone.
// Uses a YOLOv8 TFLite model (COCO) via react-native-fast-tflite (JSI).
//
// Pipeline:  base64 JPEG  ->  decode (jpeg-js)  ->  letterbox 640x640
//            ->  TFLite YOLOv8  ->  decode + NMS  ->  [{name, score, box}]
//
// Model contract (see assets/README_MODEL.md):
//   input  [1, 640, 640, 3] float32 RGB 0..1 (NHWC)
//   output [1, 84, 8400]   float32  (cx,cy,w,h + 80 class scores, channel-major)

import { loadTensorflowModel } from 'react-native-fast-tflite';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';

const INPUT_SIZE = 640;
const NUM_CLASSES = 80;
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

// COCO 80 class names (index = class id)
const COCO_NAMES = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light',
  'fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow',
  'elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee',
  'skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle',
  'wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange',
  'broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed',
  'dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven',
  'toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush',
];

// COCO class ids that are foods we report (others, e.g. "person", are ignored).
const FOOD_CLASS_IDS = new Set([46, 47, 48, 49, 50, 51, 52, 53, 54, 55]);

let _model = null;
let _loadError = null;
let _loading = null;

// Lazy-load the model once. Returns the model or throws a readable error.
async function getModel() {
  if (_model) return _model;
  if (_loadError) throw _loadError;
  if (!_loading) {
    _loading = (async () => {
      try {
        _model = await loadTensorflowModel(require('../../assets/yolov8n_float32.tflite'));
        // Diagnostic: surface tensor dtypes/shapes so a quantized (int8) model is obvious in logcat.
        try {
          const fmt = (t) => `${t.name} ${t.dataType} [${t.shape}]`;
          console.log('[YOLO] model inputs:', _model.inputs.map(fmt).join(' | '),
                      'outputs:', _model.outputs.map(fmt).join(' | '));
        } catch (_) {}
        return _model;
      } catch (e) {
        _loadError = new Error(
          'On-device model not ready — replace assets/yolov8n_float32.tflite with a real ' +
          'YOLOv8 export (see assets/README_MODEL.md). [' + (e?.message || e) + ']'
        );
        throw _loadError;
      }
    })();
  }
  return _loading;
}

// JPEG base64 -> letterboxed Float32Array input + the transform to map boxes back.
function preprocess(base64) {
  const raw = Buffer.from(base64, 'base64');
  const img = jpeg.decode(raw, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = img; // data = RGBA Uint8Array

  const S = INPUT_SIZE;
  const scale = Math.min(S / width, S / height);
  const nw = Math.round(width * scale);
  const nh = Math.round(height * scale);
  const padX = Math.floor((S - nw) / 2);
  const padY = Math.floor((S - nh) / 2);

  const input = new Float32Array(S * S * 3);
  input.fill(114 / 255); // neutral gray padding (YOLO convention)

  for (let y = 0; y < nh; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const si = (sy * width + sx) * 4;
      const di = ((y + padY) * S + (x + padX)) * 3;
      input[di] = data[si] / 255;
      input[di + 1] = data[si + 1] / 255;
      input[di + 2] = data[si + 2] / 255;
    }
  }
  return { input, scale, padX, padY, srcW: width, srcH: height };
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function nms(boxes) {
  boxes.sort((m, n) => n.score - m.score);
  const kept = [];
  for (const box of boxes) {
    if (kept.some((k) => k.cls === box.cls && iou(k, box) > IOU_THRESHOLD)) continue;
    kept.push(box);
  }
  return kept;
}

// Decode YOLOv8 output [1,84,8400] (channel-major) into detections.
function decode(output, tf) {
  const A = 8400;
  // some exports give normalized (0..1) coords, some give pixels (0..640)
  let pixelScale = 1;
  // peek a few w/h values to guess units
  if (output[2 * A] > 1.5 || output[3 * A] > 1.5) pixelScale = 1; // already pixels (0..640)
  else pixelScale = INPUT_SIZE; // normalized -> scale to 640

  // --- diagnostics: find the single best detection of ANY class ---
  let dbgBest = 0, dbgId = -1, dbgFoodBest = 0, dbgFoodId = -1, passCount = 0;
  for (let i = 0; i < A; i++) {
    for (let c = 0; c < NUM_CLASSES; c++) {
      const s = output[(4 + c) * A + i];
      if (s > dbgBest) { dbgBest = s; dbgId = c; }
      if (s > dbgFoodBest && FOOD_CLASS_IDS.has(c)) { dbgFoodBest = s; dbgFoodId = c; }
      if (s >= CONF_THRESHOLD) passCount++;
    }
  }
  console.log(`[YOLO] img ${tf.srcW}x${tf.srcH} pxScale=${pixelScale} | topAny=${COCO_NAMES[dbgId]}(${dbgBest.toFixed(2)}) topFood=${COCO_NAMES[dbgFoodId]}(${dbgFoodBest.toFixed(2)}) | anchorsOverThresh=${passCount}`);

  const dets = [];
  for (let i = 0; i < A; i++) {
    let best = 0;
    let bestId = -1;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const s = output[(4 + c) * A + i];
      if (s > best) { best = s; bestId = c; }
    }
    if (best < CONF_THRESHOLD || !FOOD_CLASS_IDS.has(bestId)) continue;

    const cx = output[i] * pixelScale;
    const cy = output[A + i] * pixelScale;
    const w = output[2 * A + i] * pixelScale;
    const h = output[3 * A + i] * pixelScale;

    // map from letterboxed 640-space back to source-image pixels
    const x = (cx - w / 2 - tf.padX) / tf.scale;
    const y = (cy - h / 2 - tf.padY) / tf.scale;
    dets.push({ x, y, w: w / tf.scale, h: h / tf.scale, score: best, cls: bestId, name: COCO_NAMES[bestId] });
  }
  return nms(dets);
}

/**
 * Detect foods in a base64 JPEG, fully on-device.
 * Returns detections sorted by confidence: [{ name, score, box:{x,y,w,h} }]
 * Throws a readable error if the model isn't ready.
 */
export async function detectFoodLocal(base64) {
  const model = await getModel();
  const tf = preprocess(base64);
  const outputs = model.runSync([tf.input]);
  const output = outputs[0]; // Float32Array length 84*8400
  if (!output || output.length < 84 * 8400) {
    throw new Error('Unexpected model output shape — expected YOLOv8 [1,84,8400].');
  }
  const dets = decode(output, tf);
  return dets.map((d) => ({
    name: d.name,
    score: Math.round(d.score * 100) / 100,
    box: { x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.w), h: Math.round(d.h) },
  }));
}

export function isModelError(e) {
  return e === _loadError;
}
