import { GEMINI_API_KEY } from '../constants/APIKeys';
import { lookupGI } from '../data/GlycemicIndex';

// Gemini multimodal model that supports image input + structured JSON output.
// Change this single constant to swap models. NOTE: this project's key has zero
// free-tier quota for the pinned 'gemini-2.0-flash'; 'gemini-flash-latest' has quota
// and supports vision + responseSchema (verified 2026-06-02).
const GEMINI_MODEL = 'gemini-flash-latest';
const ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = [
  'You are a nutrition expert analyzing a single photo of a meal/plate.',
  'Identify the food items visible. Order them by how prominent they are (most prominent first).',
  'For the SINGLE most prominent food item, estimate:',
  '- the visible portion size in grams (portionGrams)',
  '- a short human-readable portion label (portionLabel), e.g. "1 medium bowl (~200 g)"',
  '- standard nutrition values PER 100 GRAMS (not per portion) in per100g.',
  'Use realistic reference values for that food. confidence is 0..1.',
  'If you cannot see any food, return an empty foods array.',
].join('\n');

// OpenAPI-subset schema understood by Gemini structured output.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    foods: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['name'],
      },
    },
    portionGrams: { type: 'NUMBER' },
    portionLabel: { type: 'STRING' },
    per100g: {
      type: 'OBJECT',
      properties: {
        calories:     { type: 'NUMBER' },
        protein:      { type: 'NUMBER' },
        carbs:        { type: 'NUMBER' },
        fat:          { type: 'NUMBER' },
        saturatedFat: { type: 'NUMBER' },
        sugar:        { type: 'NUMBER' },
        fiber:        { type: 'NUMBER' },
        sodium:       { type: 'NUMBER' },
        cholesterol:  { type: 'NUMBER' },
        potassium:    { type: 'NUMBER' },
        calcium:      { type: 'NUMBER' },
        iron:         { type: 'NUMBER' },
      },
    },
  },
  required: ['foods'],
};

/**
 * Analyze a base64 JPEG of a meal with Gemini.
 * Returns: { foods: [{name, confidence}], portionGrams, portionLabel, per100g }
 * Throws on network/auth/parse failure so the caller can fall back to Vision.
 */
export async function analyzeFoodImageGemini(base64Image, mimeType = 'image/jpeg') {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('PASTE_')) {
    throw new Error('Gemini API key not set in src/constants/APIKeys.js');
  }

  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || 'no content';
    throw new Error(`Gemini returned no content (${reason})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error('Gemini returned non-JSON output');
  }

  const foods = (parsed.foods || [])
    .filter(f => f && f.name)
    .map(f => ({ name: String(f.name), confidence: typeof f.confidence === 'number' ? f.confidence : 0.9 }));

  if (!foods.length) throw new Error('Gemini detected no food');

  return {
    foods,
    portionGrams: typeof parsed.portionGrams === 'number' ? parsed.portionGrams : null,
    portionLabel: parsed.portionLabel ? String(parsed.portionLabel) : null,
    per100g: parsed.per100g && typeof parsed.per100g === 'object' ? parsed.per100g : null,
  };
}

const r1 = (v) => (v == null ? 0 : Math.round(Number(v) * 10) / 10); // 1 decimal
const r0 = (v) => (v == null ? 0 : Math.round(Number(v)));           // integer

/**
 * Build a nutrition object (same shape as NutritionAPI.getNutrition) from Gemini's
 * per-100g estimate. Used as a fallback when USDA has no match for the food.
 */
export function nutritionFromGemini(foodName, per100g) {
  const p = per100g || {};
  const gi = lookupGI(foodName);
  return {
    name: foodName,
    queryName: foodName,
    calories:     r0(p.calories),
    protein:      r1(p.protein),
    carbs:        r1(p.carbs),
    fat:          r1(p.fat),
    saturatedFat: r1(p.saturatedFat),
    sugar:        r1(p.sugar),
    fiber:        r1(p.fiber),
    sodium:       r0(p.sodium),
    cholesterol:  r0(p.cholesterol),
    potassium:    r0(p.potassium),
    calcium:      r0(p.calcium),
    iron:         r1(p.iron),

    gi:         gi ? gi.value : null,
    giCategory: gi ? gi.category : null,
    giSource:   gi ? gi.source : null,

    nutritionSource: 'Gemini estimate',
  };
}
