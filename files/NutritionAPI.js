// ─────────────────────────────────────────────────────────────────────────────
// NutritionAPI.js  –  Goal 1
// Queries USDA FoodData Central and returns a complete list of
// <nutrition, measure> pairs scaled to the estimated portion weight.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const USDA_API_KEY   = 'YOUR_USDA_API_KEY';   // free at fdc.nal.usda.gov
const USDA_BASE_URL  = 'https://api.nal.usda.gov/fdc/v1';

// Local SQLite-style cache key prefix
const CACHE_PREFIX   = 'nutrition:';
const CACHE_TTL_MS   = 7 * 24 * 60 * 60 * 1000;  // 7 days

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NutrientPair – the core <nutrition, measure> pair required by Goal 1.
 * {
 *   nutrient:  string,   // e.g. "Energy", "Protein", "Total Fat"
 *   value:     number,   // scaled to portionGrams
 *   unit:      string,   // e.g. "kcal", "g", "mg", "µg"
 *   category:  string,   // "macro" | "vitamin" | "mineral" | "other"
 * }
 */

/**
 * NutritionResult
 * {
 *   foodName:      string,
 *   fdcId:         number,
 *   portionGrams:  number,
 *   pairs:         NutrientPair[],   // full list
 *   summary:       {                 // quick-access top-level macros
 *     calories, protein, carbs, fat, saturatedFat, sugar, sodium, fibre
 *   }
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getNutritionForFood
 * Main entry point.  Looks up a food by name and returns full NutritionResult.
 *
 * @param {string} foodLabel     – e.g. "grilled chicken"
 * @param {number} portionGrams  – estimated portion weight in grams
 * @returns {Promise<NutritionResult | null>}
 */
export async function getNutritionForFood(foodLabel, portionGrams = 100) {
  const cacheKey = `${CACHE_PREFIX}${foodLabel.toLowerCase()}`;

  // 1. Check cache
  const cached = await getCached(cacheKey);
  if (cached) {
    return scaleResult(cached, portionGrams);
  }

  // 2. Search USDA
  const searchResult = await searchFood(foodLabel);
  if (!searchResult) return null;

  // 3. Fetch full nutrient detail
  const raw = await fetchNutrientDetail(searchResult.fdcId);
  if (!raw) return null;

  // 4. Build the <nutrition, measure> pair list
  const baseResult = buildNutritionResult(searchResult.description, searchResult.fdcId, raw);

  // 5. Cache the per-100g base result
  await setCached(cacheKey, baseResult);

  // 6. Scale to actual portion size and return
  return scaleResult(baseResult, portionGrams);
}

/**
 * getNutritionForPlate
 * Convenience wrapper for multi-food scanning (Goal 1 multi-region).
 * Accepts an array of { label, portionGrams } and returns results in parallel.
 *
 * @param {Array<{label: string, portionGrams: number}>} items
 * @returns {Promise<NutritionResult[]>}
 */
export async function getNutritionForPlate(items) {
  const promises = items.map(item =>
    getNutritionForFood(item.label, item.portionGrams)
  );
  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

/**
 * aggregatePlateNutrition
 * Sums a list of NutritionResults into a single plate-level summary.
 * Used for the total daily intake HUD.
 *
 * @param {NutritionResult[]} results
 * @returns {{ calories, protein, carbs, fat, saturatedFat, sugar, sodium, fibre }}
 */
export function aggregatePlateNutrition(results) {
  const zero = { calories: 0, protein: 0, carbs: 0, fat: 0,
                 saturatedFat: 0, sugar: 0, sodium: 0, fibre: 0 };

  return results.reduce((acc, r) => {
    if (!r) return acc;
    const s = r.summary;
    return {
      calories:     round(acc.calories     + s.calories),
      protein:      round(acc.protein      + s.protein),
      carbs:        round(acc.carbs        + s.carbs),
      fat:          round(acc.fat          + s.fat),
      saturatedFat: round(acc.saturatedFat + s.saturatedFat),
      sugar:        round(acc.sugar        + s.sugar),
      sodium:       round(acc.sodium       + s.sodium),
      fibre:        round(acc.fibre        + s.fibre),
    };
  }, zero);
}

// ─────────────────────────────────────────────────────────────────────────────
// USDA API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function searchFood(query) {
  try {
    const url = `${USDA_BASE_URL}/foods/search`
      + `?query=${encodeURIComponent(query)}`
      + `&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`
      + `&pageSize=1`
      + `&api_key=${USDA_API_KEY}`;

    const res  = await fetch(url);
    const data = await res.json();
    const food = data?.foods?.[0];
    if (!food) return null;

    return { fdcId: food.fdcId, description: food.description };
  } catch (e) {
    console.error('[NutritionAPI] Search failed:', e);
    return null;
  }
}

async function fetchNutrientDetail(fdcId) {
  try {
    const url = `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data?.foodNutrients ?? null;
  } catch (e) {
    console.error('[NutritionAPI] Detail fetch failed:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildNutritionResult
 * Converts raw USDA foodNutrients array into structured NutritionResult per 100g.
 */
function buildNutritionResult(foodName, fdcId, rawNutrients) {
  // USDA nutrient name → our display label + unit + category
  const NUTRIENT_MAP = [
    // ── Macros ──────────────────────────────────────────────────────────────
    { match: 'Energy',                          label: 'Energy (Calories)', unit: 'kcal', cat: 'macro',   key: 'calories'     },
    { match: 'Protein',                         label: 'Protein',           unit: 'g',    cat: 'macro',   key: 'protein'      },
    { match: 'Carbohydrate, by difference',     label: 'Carbohydrates',     unit: 'g',    cat: 'macro',   key: 'carbs'        },
    { match: 'Total lipid (fat)',               label: 'Total Fat',         unit: 'g',    cat: 'macro',   key: 'fat'          },
    { match: 'Fatty acids, total saturated',    label: 'Saturated Fat',     unit: 'g',    cat: 'macro',   key: 'saturatedFat' },
    { match: 'Fatty acids, total trans',        label: 'Trans Fat',         unit: 'g',    cat: 'macro',   key: null           },
    { match: 'Fatty acids, total monounsat',    label: 'Monounsaturated Fat', unit: 'g',  cat: 'macro',   key: null           },
    { match: 'Fatty acids, total polyunsat',    label: 'Polyunsaturated Fat', unit: 'g',  cat: 'macro',   key: null           },
    { match: 'Cholesterol',                     label: 'Cholesterol',       unit: 'mg',   cat: 'macro',   key: null           },
    { match: 'Sugars, total including NLEA',    label: 'Total Sugars',      unit: 'g',    cat: 'macro',   key: 'sugar'        },
    { match: 'Fiber, total dietary',            label: 'Dietary Fibre',     unit: 'g',    cat: 'macro',   key: 'fibre'        },
    // ── Minerals ────────────────────────────────────────────────────────────
    { match: 'Sodium, Na',                      label: 'Sodium',            unit: 'mg',   cat: 'mineral', key: 'sodium'       },
    { match: 'Potassium, K',                    label: 'Potassium',         unit: 'mg',   cat: 'mineral', key: null           },
    { match: 'Calcium, Ca',                     label: 'Calcium',           unit: 'mg',   cat: 'mineral', key: null           },
    { match: 'Iron, Fe',                        label: 'Iron',              unit: 'mg',   cat: 'mineral', key: null           },
    { match: 'Magnesium, Mg',                   label: 'Magnesium',         unit: 'mg',   cat: 'mineral', key: null           },
    { match: 'Phosphorus, P',                   label: 'Phosphorus',        unit: 'mg',   cat: 'mineral', key: null           },
    { match: 'Zinc, Zn',                        label: 'Zinc',              unit: 'mg',   cat: 'mineral', key: null           },
    // ── Vitamins ────────────────────────────────────────────────────────────
    { match: 'Vitamin C',                       label: 'Vitamin C',         unit: 'mg',   cat: 'vitamin', key: null           },
    { match: 'Vitamin D',                       label: 'Vitamin D',         unit: 'µg',   cat: 'vitamin', key: null           },
    { match: 'Vitamin A, RAE',                  label: 'Vitamin A',         unit: 'µg',   cat: 'vitamin', key: null           },
    { match: 'Vitamin B-12',                    label: 'Vitamin B12',       unit: 'µg',   cat: 'vitamin', key: null           },
    { match: 'Vitamin B-6',                     label: 'Vitamin B6',        unit: 'mg',   cat: 'vitamin', key: null           },
    { match: 'Vitamin K',                       label: 'Vitamin K',         unit: 'µg',   cat: 'vitamin', key: null           },
    { match: 'Folate, total',                   label: 'Folate',            unit: 'µg',   cat: 'vitamin', key: null           },
    { match: 'Niacin',                          label: 'Niacin (B3)',       unit: 'mg',   cat: 'vitamin', key: null           },
    { match: 'Thiamin',                         label: 'Thiamin (B1)',      unit: 'mg',   cat: 'vitamin', key: null           },
    { match: 'Riboflavin',                      label: 'Riboflavin (B2)',   unit: 'mg',   cat: 'vitamin', key: null           },
  ];

  // Build lookup map from USDA nutrient name → value
  const usdaLookup = {};
  rawNutrients.forEach(n => {
    const name = n.nutrient?.name ?? n.nutrientName ?? '';
    usdaLookup[name] = n.amount ?? n.value ?? 0;
  });

  const pairs = [];
  const summary = {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    saturatedFat: 0, sugar: 0, sodium: 0, fibre: 0,
  };

  NUTRIENT_MAP.forEach(def => {
    // Try exact match first, then partial match
    let rawVal = usdaLookup[def.match];
    if (rawVal === undefined) {
      const partialKey = Object.keys(usdaLookup).find(k =>
        k.toLowerCase().includes(def.match.toLowerCase().split(',')[0])
      );
      rawVal = partialKey ? usdaLookup[partialKey] : 0;
    }

    const value = round(rawVal ?? 0);
    pairs.push({ nutrient: def.label, value, unit: def.unit, category: def.cat });

    if (def.key && summary[def.key] !== undefined) {
      summary[def.key] = value;
    }
  });

  return {
    foodName,
    fdcId,
    portionGrams: 100,   // base is always per 100g; scale later
    pairs,
    summary,
  };
}

/**
 * scaleResult
 * Proportionally scales all nutrient values from the 100g base to portionGrams.
 */
function scaleResult(baseResult, portionGrams) {
  const factor = portionGrams / 100;
  const scaledPairs = baseResult.pairs.map(p => ({
    ...p,
    value: round(p.value * factor),
  }));

  const scaledSummary = {};
  Object.keys(baseResult.summary).forEach(k => {
    scaledSummary[k] = round(baseResult.summary[k] * factor);
  });

  return {
    ...baseResult,
    portionGrams,
    pairs: scaledPairs,
    summary: scaledSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getCached(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch (_) {
    return null;
  }
}

async function setCached(key, data) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function round(val, decimals = 1) {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}
