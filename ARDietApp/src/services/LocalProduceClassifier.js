// On-device RAW produce classifier — the missing piece for fruit/vegetable
// accuracy. The AIY dish classifier (LocalFoodClassifier) can ONLY name prepared
// dishes (Apple pie, Banana split...) and the SSD box detector knows just 4
// fruits; neither recognizes a plain pear, kiwi, tomato, etc. This model fills
// that gap with a dedicated fruit/vegetable classifier — fully on-device, the
// image never leaves the phone.
//
// Model: assets/produce.tflite (you supply — see produceModelSource.js).
// Labels: src/data/ProduceLabels.js (must match the model's class order).
//
// Pipeline mirrors LocalFoodClassifier: base64 JPEG -> decode -> center-crop
// square -> resize to model input -> TFLite -> top-K produce.
//
// If no model is wired (produceModelSource exports null) or it fails to load,
// classifyProduceLocal() resolves to [] so SCAN degrades gracefully.

import { loadTensorflowModel } from 'react-native-fast-tflite';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import PRODUCE_MODEL_SOURCE from './produceModelSource';
import { PRODUCE_LABELS } from '../data/ProduceLabels';

const TOP_K = 3;
const MIN_SCORE = 0.3;

let _model = null;
let _loadError = null;
let _loading = null;

export function isProduceModelEnabled() {
  return PRODUCE_MODEL_SOURCE != null;
}

async function getModel() {
  if (!isProduceModelEnabled()) return null; // no model wired → disabled
  if (_model) return _model;
  if (_loadError) throw _loadError;
  if (!_loading) {
    _loading = (async () => {
      try {
        _model = await loadTensorflowModel(PRODUCE_MODEL_SOURCE);
        try {
          console.log('[Produce] inputs:', JSON.stringify(_model.inputs),
                      '| outputs:', JSON.stringify(_model.outputs));
        } catch (_) {}
        return _model;
      } catch (e) {
        _loadError = new Error('Produce model failed to load (assets/produce.tflite). [' + (e?.message || e) + ']');
        throw _loadError;
      }
    })();
  }
  return _loading;
}

// JPEG base64 -> center-cropped square, resized to size x size (RGB).
function preprocess(base64, size, wantFloat) {
  const raw = Buffer.from(base64, 'base64');
  const img = jpeg.decode(raw, { useTArray: true, formatAsRGBA: true });
  const { width, height, data } = img;

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

/**
 * Classify raw produce in a base64 JPEG, fully on-device.
 * Returns top matches: [{ name, score }] (score 0..1), or [] if the model isn't
 * wired/loadable or nothing clears the confidence floor. Never throws — produce
 * recognition is additive, so a failure shouldn't break the whole scan.
 */
export async function classifyProduceLocal(base64) {
  let model;
  try {
    model = await getModel();
  } catch (_) {
    return [];
  }
  if (!model) return [];

  try {
    const inp = model.inputs[0];
    const size = inp.shape?.[1] || 224;
    const wantFloat = String(inp.dataType) === 'float32';

    const input = preprocess(base64, size, wantFloat);
    const outputs = model.runSync([input]);
    const output = outputs[0];

    const isQuant = String(model.outputs?.[0]?.dataType || '') !== 'float32';
    const n = Math.min(output.length, PRODUCE_LABELS.length);

    const top = [];
    for (let i = 0; i < n; i++) {
      const score = isQuant ? output[i] / 255 : output[i];
      if (score < MIN_SCORE) continue;
      top.push({ name: PRODUCE_LABELS[i], score });
    }
    top.sort((a, b) => b.score - a.score);

    console.log('[Produce] top:',
      top.slice(0, TOP_K).map((t) => `${t.name}(${t.score.toFixed(2)})`).join(', ') || '(none)');

    return top.slice(0, TOP_K).map((t) => ({
      name: t.name,
      score: Math.round(t.score * 100) / 100,
    }));
  } catch (e) {
    console.warn('[Produce] inference failed:', String(e?.message || e));
    return [];
  }
}
