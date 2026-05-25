// ─────────────────────────────────────────────────────────────────────────────
// FoodRecognition.js  –  Goal 1
// Captures camera frames and identifies food items via Clarifai Food API.
// Returns an array of { label, confidence, boundingBox } objects.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLARIFAI_API_KEY  = 'YOUR_CLARIFAI_API_KEY';   // replace with your key
const CLARIFAI_MODEL_ID = 'bd367be194cf45149e75f01d59f77ba7'; // Food Recognition model

// Minimum confidence threshold – results below this are discarded
const MIN_CONFIDENCE = 0.65;

// How many top results to return per frame (one per detected food item)
const MAX_RESULTS = 6;

// Simple in-memory cache so identical frames don't re-hit the API
const recognitionCache = new Map();

/**
 * identifyFoodItems
 * Sends a base64-encoded camera frame to the Clarifai Food model.
 *
 * @param {string} base64Image  – Raw base64 image string (no data: prefix)
 * @returns {Promise<Array>}    – Array of FoodConcept objects
 *
 * FoodConcept shape:
 *   {
 *     id:         string,   // Clarifai concept ID
 *     label:      string,   // e.g. "grilled chicken", "caesar salad"
 *     confidence: number,   // 0.0 – 1.0
 *     region: {             // bounding box in image-fraction coords (0..1)
 *       x: number, y: number, w: number, h: number
 *     } | null
 *   }
 */
export async function identifyFoodItems(base64Image) {
  // Cache check (hash on first 200 chars of base64 – fast approximation)
  const cacheKey = base64Image.slice(0, 200);
  if (recognitionCache.has(cacheKey)) {
    return recognitionCache.get(cacheKey);
  }

  const body = {
    user_app_id: { app_id: 'main' },
    inputs: [
      {
        data: {
          image: { base64: base64Image },
        },
      },
    ],
  };

  let response;
  try {
    response = await fetch(
      `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/outputs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${CLARIFAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
  } catch (networkErr) {
    console.error('[FoodRecognition] Network error:', networkErr);
    return getFallbackResults();
  }

  if (!response.ok) {
    console.error('[FoodRecognition] API error:', response.status);
    return getFallbackResults();
  }

  const data = await response.json();
  const rawConcepts = data?.outputs?.[0]?.data?.concepts ?? [];

  const results = rawConcepts
    .filter(c => c.value >= MIN_CONFIDENCE)
    .slice(0, MAX_RESULTS)
    .map(c => ({
      id:         c.id,
      label:      normalizeLabel(c.name),
      confidence: Math.round(c.value * 100),
      region:     null,   // Clarifai Food model does not return bounding boxes;
                          // position is handled by AR plane detection in the scene
    }));

  // Cache the result
  recognitionCache.set(cacheKey, results);

  // Persist top result to AsyncStorage for session history
  if (results.length > 0) {
    await logDetection(results[0].label);
  }

  return results;
}

/**
 * identifyFoodItemsMultiRegion
 * For multi-food plate scanning:
 * Accepts an array of cropped base64 sub-images (one per detected AR region)
 * and runs recognition on each in parallel.
 *
 * @param {Array<{id: string, base64: string}>} regions
 * @returns {Promise<Array<{regionId, food}>>}
 */
export async function identifyFoodItemsMultiRegion(regions) {
  const promises = regions.map(async region => {
    const foods = await identifyFoodItems(region.base64);
    return {
      regionId: region.id,
      food:     foods[0] ?? null,   // take top result per region
    };
  });

  return Promise.all(promises);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * normalizeLabel
 * Converts Clarifai raw label to a cleaner USDA-friendly search term.
 * e.g. "hamburger or cheeseburger" → "hamburger"
 */
function normalizeLabel(rawLabel) {
  return rawLabel
    .toLowerCase()
    .split(' or ')[0]         // take first option if multiple given
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * getFallbackResults
 * Returns a placeholder when API is unavailable (e.g. offline demo mode).
 */
function getFallbackResults() {
  return [
    { id: 'fallback_1', label: 'mixed food plate', confidence: 0, region: null },
  ];
}

/**
 * logDetection
 * Appends detected food label to today's detection log in AsyncStorage.
 */
async function logDetection(label) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key   = `detections:${today}`;
    const raw   = await AsyncStorage.getItem(key);
    const log   = raw ? JSON.parse(raw) : [];
    log.push({ label, timestamp: Date.now() });
    await AsyncStorage.setItem(key, JSON.stringify(log));
  } catch (_) {
    // Non-critical – silently ignore storage errors
  }
}
