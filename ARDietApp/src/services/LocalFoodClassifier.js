// Fully on-device food recognition — the camera image NEVER leaves the phone.
//
// Uses the Google AIY "vision classifier food V1" TFLite model (MobileNet-based,
// 2,024 food dishes incl. international cuisine) via react-native-fast-tflite (JSI).
// This replaces the COCO YOLO detector as the SCAN recognizer: a dish classifier
// with a 2,024-food vocabulary identifies real meals far better than COCO's
// 10 generic food classes.
//
// Pipeline:  base64 JPEG -> decode (jpeg-js) -> center-crop square -> resize to
//            model input (typically 224x224 uint8 RGB) -> TFLite -> top-K dishes
//
// Model: assets/aiy_food_V1.tflite (TF Hub / Kaggle: google/aiy/tfLite/vision-classifier-food-v1)
// Labels: src/data/AiyFoodLabels.js (extracted from the model's embedded metadata)

import { loadTensorflowModel } from 'react-native-fast-tflite';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import { AIY_FOOD_LABELS } from '../data/AiyFoodLabels';

const TOP_K = 5;
const MIN_SCORE = 0.12; // quantized-probability floor below which we call it "no food"

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
        _model = await loadTensorflowModel(require('../../assets/aiy_food_V1.tflite'));
        try {
          console.log('[FoodClassifier] inputs:', JSON.stringify(_model.inputs),
                      '| outputs:', JSON.stringify(_model.outputs));
        } catch (e) {
          console.log('[FoodClassifier] tensor info unavailable:', String(e?.message || e));
        }
        return _model;
      } catch (e) {
        _loadError = new Error(
          'On-device food model failed to load (assets/aiy_food_V1.tflite). [' +
          (e?.message || e) + ']'
        );
        throw _loadError;
      }
    })();
  }
  return _loading;
}

// JPEG base64 -> center-cropped square, resized to size x size.
// Returns Uint8Array (0..255) or Float32Array (0..1) depending on what the model wants.
function preprocess(base64, size, wantFloat) {
  const raw = Buffer.from(base64, 'base64');
  const img = jpeg.decode(raw, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = img; // RGBA

  const side = Math.min(width, height);
  const offX = Math.floor((width - side) / 2);
  const offY = Math.floor((height - side) / 2);

  const out = wantFloat ? new Float32Array(size * size * 3) : new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const sy = offY + Math.min(side - 1, Math.floor((y * side) / size));
    for (let x = 0; x < size; x++) {
      const sx = offX + Math.min(side - 1, Math.floor((x * side) / size));
      const si = (sy * width + sx) * 4;
      const di = (y * size + x) * 3;
      if (wantFloat) {
        out[di] = data[si] / 255;
        out[di + 1] = data[si + 1] / 255;
        out[di + 2] = data[si + 2] / 255;
      } else {
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
      }
    }
  }
  return out;
}

// Labels to never report: background sentinel and unnamed Knowledge Graph ids.
function isReportable(label) {
  return label && label !== '__background__' && !label.startsWith('/g/');
}

/**
 * Classify the food in a base64 JPEG, fully on-device.
 * Returns top matches sorted by confidence: [{ name, score }] (score 0..1).
 * Throws a readable error if the model can't load or nothing scores above the floor.
 */
export async function classifyFoodLocal(base64) {
  const model = await getModel();

  const inp = model.inputs[0];
  const size = inp.shape?.[1] || 224;
  const wantFloat = String(inp.dataType) === 'float32';

  const input = preprocess(base64, size, wantFloat);
  const outputs = model.runSync([input]);
  const output = outputs[0];

  // uint8-quantized probabilities -> 0..1; float passes through.
  const isQuant = String(model.outputs?.[0]?.dataType || '') !== 'float32';
  const n = Math.min(output.length, AIY_FOOD_LABELS.length);

  const top = [];
  let rawBest = 0, rawBestIdx = -1; // best of ANY class, ignoring the floor (diagnostics)
  for (let i = 0; i < n; i++) {
    const score = isQuant ? output[i] / 255 : output[i];
    if (score > rawBest) { rawBest = score; rawBestIdx = i; }
    if (score < MIN_SCORE) continue;
    if (!isReportable(AIY_FOOD_LABELS[i])) continue;
    top.push({ name: AIY_FOOD_LABELS[i], score });
  }
  top.sort((a, b) => b.score - a.score);

  console.log(`[FoodClassifier] in=${size}px ${wantFloat ? 'float32' : 'uint8'} quantOut=${isQuant}`,
    '| rawBest:', rawBestIdx >= 0 ? `${AIY_FOOD_LABELS[rawBestIdx]}(${rawBest.toFixed(3)})` : 'n/a',
    '| top:', top.slice(0, TOP_K).map((t) => `${t.name}(${t.score.toFixed(2)})`).join(', ') || '(none)');

  return top.slice(0, TOP_K).map((t) => ({
    name: t.name,
    score: Math.round(t.score * 100) / 100,
  }));
}

export function isModelError(e) {
  return e === _loadError;
}
