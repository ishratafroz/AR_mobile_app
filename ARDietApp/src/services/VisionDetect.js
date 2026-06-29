// OPTIONAL local-AI plate detection — real multi-item food recognition using a
// VISION model running in Ollama on the paired PC (reached over USB via
// `adb reverse tcp:11434 tcp:11434`, same bridge as the Llama 3 chat).
//
// WHY this and not on-device: the phone's TFLite models (15-class box detector +
// whole-dish classifier) cannot separate the foods in a mixed bowl. A vision LLM
// can. Text `llama3` CANNOT see images — this needs a vision model such as
// `llava`, `moondream`, `bakllava`, or `llama3.2-vision` pulled in Ollama.
//
// PRIVACY: unlike the default on-device SCAN, this sends the meal IMAGE to the
// user's OWN PC (localhost over USB), not a third-party cloud. It is opt-in.

import { getNutritionOffline } from './NutritionAPI';

const HOST = 'http://localhost:11434';
// Vision inference is slow on a laptop GPU — a COLD model load (e.g. qwen2.5vl
// ~3.2 GB into VRAM) plus first inference on a full-res photo can take ~60-90s.
const TIMEOUT_MS = 120000;

// Ollama tags that indicate a vision-capable model, STRONGEST FIRST. moondream
// (tiny, hallucination-prone) is the last resort — when a better model is pulled
// (qwen2.5vl / minicpm-v / llava…), the app auto-prefers it with no code change.
const VISION_HINTS = [
  // Prefer larger/stronger tags first when several are installed.
  'qwen2.5vl:32b', 'qwen2.5vl:7b', 'qwen2-vl:7b', 'minicpm-v', 'llama3.2-vision:11b',
  'qwen2.5vl', 'qwen2-vl', 'llama3.2-vision', 'llama3-vision',
  'llava-llama3', 'llava:13b', 'llava', 'bakllava', 'gemma3', 'llava-phi3', 'moondream',
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

// Find a pulled vision model on the local Ollama, or null if none is installed.
export async function getVisionModel() {
  const res = await withTimeout(fetch(`${HOST}/api/tags`), 5000);
  if (!res.ok) return null;
  const json = await res.json();
  const names = (json.models || []).map(m => (m.name || '').toLowerCase());
  console.log('[VisionDetect] available models:', JSON.stringify(names));
  for (const hint of VISION_HINTS) {
    const hit = names.find(n => n.includes(hint));
    if (hit) { console.log('[VisionDetect] selected model:', hit); return hit; }
  }
  console.log('[VisionDetect] no vision model found');
  return null;
}

export async function isVisionAvailable() {
  try { return !!(await getVisionModel()); } catch (_) { return false; }
}

// IMPORTANT: the format example uses PLACEHOLDER words (not real foods). Listing
// real foods here makes small models copy them into the answer (that bug made it
// report "avocado" on a breakfast plate). Strong, explicit anti-hallucination rules
// matter most for small local VLMs.
const PROMPT =
  'You are an expert food-recognition system analysing a photo of a meal. ' +
  'Scan the plate carefully, section by section (top, bottom, left, right, centre), ' +
  'and list EVERY distinct food item you can actually see — including small sides, ' +
  'garnishes, sauces, dips and drinks.\n' +
  'Rules:\n' +
  '- List each distinct food separately; do NOT merge different foods into one entry.\n' +
  '- Only include foods that are genuinely visible in THIS image.\n' +
  '- Do NOT guess or add foods that are not visible just because they are common.\n' +
  '- If unsure whether something is present, leave it out.\n' +
  '- Use simple, specific lowercase names for the actual food (e.g. "scrambled eggs", ' +
  '"bacon", "sweet potato"), not vague categories like "food" or "meal".\n' +
  'Reply with ONLY a JSON array of lowercase food-name strings and nothing else. ' +
  'The brackets below show ONLY the output format — do NOT copy these placeholder words: ' +
  '["<food1>","<food2>","<food3>"]';

// Pull a JSON array (or a loose comma/newline list) of food names out of the
// model's reply and normalise to [{ name, count }] with table-resolvable names.
function parseFoods(raw) {
  if (!raw) return [];
  let list = null;
  const m = raw.match(/\[[\s\S]*?\]/);
  if (m) { try { list = JSON.parse(m[0]); } catch (_) {} }
  if (!Array.isArray(list)) {
    list = raw.replace(/[\[\]"`*]/g, '')
              .split(/[,\n]/)
              .map(s => s.replace(/^\s*[-•\d.]+\s*/, '').trim())
              .filter(Boolean);
  }
  const seen = new Set();
  const out = [];
  for (let name of list) {
    if (typeof name !== 'string') continue;
    name = name.toLowerCase().trim();
    if (!name || name.length > 30) continue;
    if (name.includes('<') || name.includes('>')) continue; // echoed format placeholder
    if (/^(food|item|none|n\/a|unknown)\d*$/.test(name)) continue;
    // Prefer the canonical table name when the food resolves to nutrition.
    const n = getNutritionOffline(name);
    const canon = n ? (n.name || name) : name;
    const key = canon.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: canon, count: 1, hasNutrition: !!n });
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Detect the foods in a meal photo using the local vision model.
 * @param {string} base64 - JPEG base64 (no data: prefix), straight from the camera.
 * @returns {Promise<Array<{name,count,hasNutrition}>>}
 * Throws 'no-vision-model' if Ollama has no vision model pulled.
 */
export async function detectFoodsVision(base64) {
  const model = await getVisionModel();
  if (!model) throw new Error('no-vision-model');

  const body = {
    model,
    prompt: PROMPT,
    images: [base64],
    stream: false,
    keep_alive: '30m',                     // stay loaded so later scans are fast
    options: { temperature: 0, num_predict: 256 },
  };
  const res = await withTimeout(
    fetch(`${HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const json = await res.json();
  const raw = json?.response || '';
  const parsed = parseFoods(raw);
  console.log('[VisionDetect] model:', model, '| raw:', JSON.stringify(raw).slice(0, 400));
  console.log('[VisionDetect] parsed:', JSON.stringify(parsed));
  return parsed;
}
