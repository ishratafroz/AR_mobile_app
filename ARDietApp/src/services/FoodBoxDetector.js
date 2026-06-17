// On-device food DETECTOR (bounding boxes) — complements the dish classifier.
// The classifier (LocalFoodClassifier) answers "what dish is this?";
// this detector answers "WHERE is the food and HOW MANY items?" — which is what
// item counting ("3 apples") and portion estimation need.
//
// Model: assets/food_detect.tflite — SSD MobileNet trained on Open Images food
// classes (from the Food.AI project). TF1 detection-API TFLite export:
//   input : [1, S, S, 3] uint8 (raw) or float32 (normalized to [-1, 1])
//   output: boxes [1,N,4] (ymin,xmin,ymax,xmax, normalized 0..1),
//           classes [1,N], scores [1,N], numDetections [1]
//
// Everything runs locally — the image never leaves the phone.

import { loadTensorflowModel } from 'react-native-fast-tflite';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';

// Index 0 of the labelmap is the '???' background row; detector class ids are
// offset by +1 into this list (standard TF1 OD convention).
const LABELS = [
  '???', 'Bread', 'Pancake', 'Waffle', 'Bagel', 'Muffin', 'Doughnut', 'Hamburger',
  'Pizza', 'Sandwich', 'Hot dog', 'French fries', 'Apple', 'Orange', 'Banana', 'Grape',
];

// The box detector is the ONLY part of the on-device pipeline that recognizes
// RAW produce (apple/orange/banana/grape) — the AIY dish classifier's 2,024-word
// vocabulary is all prepared dishes (Apple pie, Banana split...) and structurally
// cannot output a bare fruit. So we keep this threshold low to catch raw fruit;
// the user confirms/corrects in ConfirmFood, which is the real accuracy guardrail.
const MIN_SCORE = 0.3;

let _model = null;
let _loadError = null;
let _loading = null;

async function getModel() {
  if (_model) return _model;
  if (_loadError) throw _loadError;
  if (!_loading) {
    _loading = (async () => {
      try {
        _model = await loadTensorflowModel(require('../../assets/food_detect.tflite'));
        try {
          console.log('[BoxDetector] inputs:', JSON.stringify(_model.inputs),
                      '| outputs:', JSON.stringify(_model.outputs));
        } catch (_) {}
        return _model;
      } catch (e) {
        _loadError = new Error('Food box detector failed to load. [' + (e?.message || e) + ']');
        throw _loadError;
      }
    })();
  }
  return _loading;
}

// Plain stretch-resize to S x S (SSD convention — boxes come back normalized,
// so they map straight onto the original image).
function preprocess(data, width, height, S, wantFloat) {
  const out = wantFloat ? new Float32Array(S * S * 3) : new Uint8Array(S * S * 3);
  for (let y = 0; y < S; y++) {
    const sy = Math.min(height - 1, Math.floor((y * height) / S));
    for (let x = 0; x < S; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / S));
      const si = (sy * width + sx) * 4;
      const di = (y * S + x) * 3;
      if (wantFloat) {
        // TF1 float detection models expect [-1, 1]
        out[di] = (data[si] - 127.5) / 127.5;
        out[di + 1] = (data[si + 1] - 127.5) / 127.5;
        out[di + 2] = (data[si + 2] - 127.5) / 127.5;
      } else {
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
      }
    }
  }
  return out;
}

/**
 * Detect food items with bounding boxes, fully on-device.
 * Returns [{ name, score, box: {x, y, w, h} }] — box in 0..1 fractions of the
 * source image — sorted by confidence.
 */
export async function detectFoodBoxes(base64) {
  const model = await getModel();

  const raw = Buffer.from(base64, 'base64');
  const img = jpeg.decode(raw, { useTArray: true, formatAsRGBA: true });

  const inp = model.inputs[0];
  const S = inp.shape?.[1] || 300;
  const wantFloat = String(inp.dataType) === 'float32';

  const input = preprocess(img.data, img.width, img.height, S, wantFloat);
  const outputs = model.runSync([input]);

  // Standard TF1 order: [boxes, classes, scores, count]. Verify by shape:
  // boxes is the only output with 4 values per detection.
  let boxes = outputs[0], classes = outputs[1], scores = outputs[2], count = outputs[3];
  if (model.outputs?.length === 4) {
    const idxBoxes = model.outputs.findIndex((o) => o.shape?.[o.shape.length - 1] === 4);
    if (idxBoxes > 0) {
      // non-standard ordering — remap by shape
      const rest = [0, 1, 2, 3].filter((i) => i !== idxBoxes);
      boxes = outputs[idxBoxes];
      [classes, scores, count] = rest.map((i) => outputs[i]);
    }
  }

  const n = Math.min(Math.round(count?.[0] ?? scores.length), scores.length);
  const dets = [];
  for (let i = 0; i < n; i++) {
    const score = scores[i];
    if (score < MIN_SCORE) continue;
    const name = LABELS[Math.round(classes[i]) + 1];
    if (!name || name === '???') continue;
    const ymin = boxes[i * 4], xmin = boxes[i * 4 + 1], ymax = boxes[i * 4 + 2], xmax = boxes[i * 4 + 3];
    dets.push({
      name,
      score: Math.round(score * 100) / 100,
      box: { x: xmin, y: ymin, w: Math.max(0, xmax - xmin), h: Math.max(0, ymax - ymin) },
    });
  }
  dets.sort((a, b) => b.score - a.score);

  console.log('[BoxDetector] found:',
    dets.map((d) => `${d.name}(${d.score})`).join(', ') || '(none)');
  return dets;
}
