import { USDA_API_KEY } from '../constants/APIKeys';
import { lookupGI } from '../data/GlycemicIndex';

export async function getNutrition(foodName) {
  if (!USDA_API_KEY || USDA_API_KEY.startsWith('PASTE_')) {
    throw new Error('USDA API key not set in src/constants/APIKeys.js');
  }

  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?` +
    `query=${encodeURIComponent(foodName)}` +
    `&pageSize=1&api_key=${USDA_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA HTTP ${res.status}`);

  const data = await res.json();
  const food = data?.foods?.[0];
  if (!food) return null;

  const lookup = (needle) =>
    food.foodNutrients?.find(n => (n.nutrientName || '').toLowerCase().includes(needle))?.value ?? 0;

  const gi = lookupGI(foodName) || lookupGI(food.description || '');

  return {
    name: food.description || foodName,
    queryName: foodName,
    calories:     Math.round(lookup('energy')),
    protein:      Math.round(lookup('protein') * 10) / 10,
    carbs:        Math.round(lookup('carbohydrate') * 10) / 10,
    fat:          Math.round(lookup('total lipid') * 10) / 10,
    saturatedFat: Math.round(lookup('saturated') * 10) / 10,
    sugar:        Math.round(lookup('sugars, total') * 10) / 10,
    fiber:        Math.round(lookup('fiber') * 10) / 10,
    sodium:       Math.round(lookup('sodium')),
    cholesterol:  Math.round(lookup('cholesterol')),
    potassium:    Math.round(lookup('potassium')),
    calcium:      Math.round(lookup('calcium')),
    iron:         Math.round(lookup('iron') * 10) / 10,

    gi:         gi ? gi.value : null,
    giCategory: gi ? gi.category : null,
    giSource:   gi ? gi.source : null,
  };
}

// Build a fully-formed food object without USDA (offline / fallback).
// Used by the PICK list AND by on-device YOLO detection (fully offline path).
// `serving` = typical portion in grams (used for on-device portion estimate).
const HARDCODED = {
  'pizza':           { calories: 266, protein: 11, carbs: 33, fat: 10,  saturatedFat: 4.5, sugar: 3.6, fiber: 2.3, sodium: 598, serving: 107 },
  'noodles':         { calories: 138, protein: 4.5, carbs: 25, fat: 2.1, saturatedFat: 0.4, sugar: 0.6, fiber: 1.2, sodium: 5,   serving: 200 },
  'instant noodles': { calories: 436, protein: 9,   carbs: 60, fat: 17,  saturatedFat: 7.5, sugar: 2.5, fiber: 2.5, sodium: 1731,serving: 85  },
  'biryani':         { calories: 290, protein: 8,   carbs: 35, fat: 13,  saturatedFat: 4,   sugar: 2,   fiber: 1.5, sodium: 480, serving: 250 },
  'burger':          { calories: 295, protein: 17,  carbs: 24, fat: 14,  saturatedFat: 5,   sugar: 5,   fiber: 1.5, sodium: 414, serving: 150 },
  'grilled chicken': { calories: 165, protein: 31,  carbs: 0,  fat: 3.6, saturatedFat: 1,   sugar: 0,   fiber: 0,   sodium: 74,  serving: 120 },
  'salad':           { calories: 33,  protein: 1.4, carbs: 6,  fat: 0.2, saturatedFat: 0,   sugar: 2,   fiber: 2,   sodium: 18,  serving: 100 },
  'rice':            { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, saturatedFat: 0,   sugar: 0,   fiber: 0.4, sodium: 1,   serving: 158 },
  'french fries':    { calories: 312, protein: 3.4, carbs: 41, fat: 15,  saturatedFat: 2.3, sugar: 0.3, fiber: 3.8, sodium: 210, serving: 117 },
  'donut':           { calories: 452, protein: 4.9, carbs: 51, fat: 25,  saturatedFat: 6.5, sugar: 23,  fiber: 1.4, sodium: 326, serving: 60  },
  'doughnut':        { calories: 452, protein: 4.9, carbs: 51, fat: 25,  saturatedFat: 6.5, sugar: 23,  fiber: 1.4, sodium: 326, serving: 60  },
  'apple':           { calories: 52,  protein: 0.3, carbs: 14, fat: 0.2, saturatedFat: 0,   sugar: 10,  fiber: 2.4, sodium: 1,   serving: 182 },
  'banana':          { calories: 89,  protein: 1.1, carbs: 23, fat: 0.3, saturatedFat: 0,   sugar: 12,  fiber: 2.6, sodium: 1,   serving: 118 },
  // --- COCO YOLOv8 food classes (on-device detection) ---
  'orange':          { calories: 47,  protein: 0.9, carbs: 12, fat: 0.1, saturatedFat: 0,   sugar: 9,   fiber: 2.4, sodium: 0,   serving: 131 },
  'sandwich':        { calories: 250, protein: 12,  carbs: 28, fat: 10,  saturatedFat: 4,   sugar: 4,   fiber: 2,   sodium: 600, serving: 150 },
  'broccoli':        { calories: 35,  protein: 2.4, carbs: 7,  fat: 0.4, saturatedFat: 0,   sugar: 1.4, fiber: 3.3, sodium: 41,  serving: 91  },
  'carrot':          { calories: 41,  protein: 0.9, carbs: 10, fat: 0.2, saturatedFat: 0,   sugar: 4.7, fiber: 2.8, sodium: 69,  serving: 61  },
  'hot dog':         { calories: 290, protein: 10,  carbs: 4,  fat: 26,  saturatedFat: 9,   sugar: 1,   fiber: 0,   sodium: 810, serving: 98  },
  'cake':            { calories: 370, protein: 4,   carbs: 53, fat: 16,  saturatedFat: 4,   sugar: 38,  fiber: 0.9, sodium: 320, serving: 80  },
  // --- Expanded coverage for the on-device 2,024-dish classifier (per 100 g + typical serving).
  // SCAN resolves nutrition ONLY from this table (zero network). Substring fuzzy match maps
  // classifier labels here, e.g. "Garlic naan" -> naan, "Chicken curry" -> curry.
  'bread':           { calories: 265, protein: 9,   carbs: 49, fat: 3.2, saturatedFat: 0.7, sugar: 5,   fiber: 2.7, sodium: 491, serving: 38  },
  'toast':           { calories: 293, protein: 9.8, carbs: 54, fat: 3.8, saturatedFat: 0.8, sugar: 5.5, fiber: 3,   sodium: 540, serving: 33  },
  'naan':            { calories: 310, protein: 9,   carbs: 50, fat: 8,   saturatedFat: 2,   sugar: 3,   fiber: 2,   sodium: 465, serving: 90  },
  'roti':            { calories: 264, protein: 9,   carbs: 46, fat: 5,   saturatedFat: 1,   sugar: 2,   fiber: 4.5, sodium: 298, serving: 40  },
  'chapati':         { calories: 264, protein: 9,   carbs: 46, fat: 5,   saturatedFat: 1,   sugar: 2,   fiber: 4.5, sodium: 298, serving: 40  },
  'paratha':         { calories: 326, protein: 7,   carbs: 45, fat: 13,  saturatedFat: 5,   sugar: 2,   fiber: 4,   sodium: 400, serving: 80  },
  'samosa':          { calories: 308, protein: 5,   carbs: 32, fat: 18,  saturatedFat: 4,   sugar: 2,   fiber: 2.5, sodium: 422, serving: 60  },
  'dal':             { calories: 116, protein: 7,   carbs: 18, fat: 2,   saturatedFat: 0.3, sugar: 1.5, fiber: 4,   sodium: 240, serving: 200 },
  'curry':           { calories: 150, protein: 10,  carbs: 8,  fat: 9,   saturatedFat: 3.5, sugar: 3,   fiber: 1.5, sodium: 420, serving: 250 },
  'fried rice':      { calories: 174, protein: 5,   carbs: 28, fat: 5,   saturatedFat: 1,   sugar: 1,   fiber: 1,   sodium: 460, serving: 200 },
  'pasta':           { calories: 158, protein: 6,   carbs: 31, fat: 0.9, saturatedFat: 0.2, sugar: 0.6, fiber: 1.8, sodium: 1,   serving: 200 },
  'spaghetti':       { calories: 158, protein: 6,   carbs: 31, fat: 0.9, saturatedFat: 0.2, sugar: 0.6, fiber: 1.8, sodium: 1,   serving: 200 },
  'macaroni':        { calories: 164, protein: 6,   carbs: 31, fat: 1,   saturatedFat: 0.2, sugar: 0.6, fiber: 1.5, sodium: 1,   serving: 200 },
  'ramen':           { calories: 188, protein: 5,   carbs: 27, fat: 7,   saturatedFat: 3,   sugar: 1,   fiber: 1,   sodium: 980, serving: 300 },
  'sushi':           { calories: 150, protein: 6,   carbs: 28, fat: 1,   saturatedFat: 0.2, sugar: 4,   fiber: 0.8, sodium: 340, serving: 180 },
  'omelette':        { calories: 154, protein: 11,  carbs: 1,  fat: 12,  saturatedFat: 3.5, sugar: 0.5, fiber: 0,   sodium: 155, serving: 120 },
  'egg':             { calories: 155, protein: 13,  carbs: 1.1,fat: 11,  saturatedFat: 3.3, sugar: 1.1, fiber: 0,   sodium: 124, serving: 50  },
  'pancake':         { calories: 227, protein: 6,   carbs: 28, fat: 10,  saturatedFat: 2.2, sugar: 6,   fiber: 1,   sodium: 439, serving: 77  },
  'waffle':          { calories: 291, protein: 8,   carbs: 33, fat: 14,  saturatedFat: 3,   sugar: 9,   fiber: 1.7, sodium: 511, serving: 75  },
  'muffin':          { calories: 377, protein: 5,   carbs: 53, fat: 16,  saturatedFat: 3,   sugar: 30,  fiber: 1.5, sodium: 350, serving: 113 },
  'bagel':           { calories: 250, protein: 10,  carbs: 49, fat: 1.5, saturatedFat: 0.4, sugar: 6,   fiber: 2,   sodium: 430, serving: 105 },
  'croissant':       { calories: 406, protein: 8,   carbs: 46, fat: 21,  saturatedFat: 12,  sugar: 11,  fiber: 2.6, sodium: 423, serving: 57  },
  'cookie':          { calories: 488, protein: 5,   carbs: 64, fat: 24,  saturatedFat: 8,   sugar: 36,  fiber: 2,   sodium: 360, serving: 30  },
  'chocolate':       { calories: 546, protein: 4.9, carbs: 61, fat: 31,  saturatedFat: 19,  sugar: 48,  fiber: 7,   sodium: 24,  serving: 40  },
  'ice cream':       { calories: 207, protein: 3.5, carbs: 24, fat: 11,  saturatedFat: 7,   sugar: 21,  fiber: 0.7, sodium: 80,  serving: 66  },
  'yogurt':          { calories: 59,  protein: 10,  carbs: 3.6,fat: 0.4, saturatedFat: 0.1, sugar: 3.2, fiber: 0,   sodium: 36,  serving: 170 },
  'cheese':          { calories: 402, protein: 25,  carbs: 1.3,fat: 33,  saturatedFat: 21,  sugar: 0.5, fiber: 0,   sodium: 621, serving: 28  },
  'potato':          { calories: 87,  protein: 1.9, carbs: 20, fat: 0.1, saturatedFat: 0,   sugar: 0.9, fiber: 1.8, sodium: 6,   serving: 173 },
  'fried chicken':   { calories: 246, protein: 24,  carbs: 8,  fat: 13,  saturatedFat: 3.5, sugar: 0,   fiber: 0.4, sodium: 480, serving: 140 },
  'chicken wings':   { calories: 290, protein: 27,  carbs: 0,  fat: 19,  saturatedFat: 5,   sugar: 0,   fiber: 0,   sodium: 390, serving: 100 },
  'fish':            { calories: 206, protein: 22,  carbs: 0,  fat: 12,  saturatedFat: 2.5, sugar: 0,   fiber: 0,   sodium: 61,  serving: 150 },
  'shrimp':          { calories: 99,  protein: 24,  carbs: 0.2,fat: 0.3, saturatedFat: 0.1, sugar: 0,   fiber: 0,   sodium: 111, serving: 85  },
  // --- plant proteins & staples (commonly scanned, were missing → showed 0 kcal) ---
  'tofu':            { calories: 76,  protein: 8,   carbs: 1.9,fat: 4.8, saturatedFat: 0.7, sugar: 0.6, fiber: 0.9, sodium: 7,   serving: 126 },
  'tempeh':          { calories: 192, protein: 20,  carbs: 8,  fat: 11,  saturatedFat: 2.2, sugar: 0,   fiber: 0,   sodium: 9,   serving: 84  },
  'edamame':         { calories: 121, protein: 12,  carbs: 9,  fat: 5,   saturatedFat: 0.6, sugar: 2.2, fiber: 5,   sodium: 6,   serving: 155 },
  'paneer':          { calories: 265, protein: 18,  carbs: 1.2,fat: 21,  saturatedFat: 12,  sugar: 1.2, fiber: 0,   sodium: 22,  serving: 100 },
  'beans':           { calories: 127, protein: 8.7, carbs: 23, fat: 0.5, saturatedFat: 0.1, sugar: 0.3, fiber: 6.4, sodium: 1,   serving: 177 },
  'lentils':         { calories: 116, protein: 9,   carbs: 20, fat: 0.4, saturatedFat: 0.1, sugar: 1.8, fiber: 7.9, sodium: 2,   serving: 198 },
  'chickpeas':       { calories: 164, protein: 8.9, carbs: 27, fat: 2.6, saturatedFat: 0.3, sugar: 4.8, fiber: 7.6, sodium: 7,   serving: 164 },
  'hummus':          { calories: 166, protein: 7.9, carbs: 14, fat: 9.6, saturatedFat: 1.4, sugar: 0.3, fiber: 6,   sodium: 379, serving: 60  },
  'milk':            { calories: 61,  protein: 3.2, carbs: 4.8,fat: 3.3, saturatedFat: 1.9, sugar: 5.1, fiber: 0,   sodium: 43,  serving: 244 },
  'soup':            { calories: 50,  protein: 3,   carbs: 7,  fat: 1.2, saturatedFat: 0.4, sugar: 2,   fiber: 1,   sodium: 640, serving: 245 },
  'taco':            { calories: 226, protein: 9,   carbs: 20, fat: 12,  saturatedFat: 4,   sugar: 1,   fiber: 3,   sodium: 397, serving: 102 },
  'burrito':         { calories: 206, protein: 8,   carbs: 26, fat: 8,   saturatedFat: 3,   sugar: 1.5, fiber: 2,   sodium: 495, serving: 220 },
  'grape':           { calories: 69,  protein: 0.7, carbs: 18, fat: 0.2, saturatedFat: 0.1, sugar: 16,  fiber: 0.9, sodium: 2,   serving: 92  },
  'mango':           { calories: 60,  protein: 0.8, carbs: 15, fat: 0.4, saturatedFat: 0.1, sugar: 14,  fiber: 1.6, sodium: 1,   serving: 165 },
  'strawberry':      { calories: 32,  protein: 0.7, carbs: 7.7,fat: 0.3, saturatedFat: 0,   sugar: 4.9, fiber: 2,   sodium: 1,   serving: 152 },
  'watermelon':      { calories: 30,  protein: 0.6, carbs: 7.6,fat: 0.2, saturatedFat: 0,   sugar: 6.2, fiber: 0.4, sodium: 1,   serving: 280 },
  'oatmeal':         { calories: 68,  protein: 2.4, carbs: 12, fat: 1.4, saturatedFat: 0.2, sugar: 0.5, fiber: 1.7, sodium: 49,  serving: 234 },
  'cereal':          { calories: 379, protein: 7,   carbs: 84, fat: 1,   saturatedFat: 0.2, sugar: 22,  fiber: 3,   sodium: 500, serving: 40  },
  // --- nuts & packaged snacks ---
  'peanut':          { calories: 567, protein: 26,  carbs: 16, fat: 49,  saturatedFat: 6.3, sugar: 4.7, fiber: 8.5, sodium: 18,  serving: 28  },
  'almond':          { calories: 579, protein: 21,  carbs: 22, fat: 50,  saturatedFat: 3.8, sugar: 4.4, fiber: 12.5,sodium: 1,   serving: 28  },
  'cashew':          { calories: 553, protein: 18,  carbs: 30, fat: 44,  saturatedFat: 7.8, sugar: 5.9, fiber: 3.3, sodium: 12,  serving: 28  },
  'walnut':          { calories: 654, protein: 15,  carbs: 14, fat: 65,  saturatedFat: 6.1, sugar: 2.6, fiber: 6.7, sodium: 2,   serving: 28  },
  'pistachio':       { calories: 560, protein: 20,  carbs: 28, fat: 45,  saturatedFat: 5.9, sugar: 7.7, fiber: 10.6,sodium: 1,   serving: 28  },
  'mixed nuts':      { calories: 607, protein: 20,  carbs: 21, fat: 54,  saturatedFat: 8.5, sugar: 4.2, fiber: 7,   sodium: 12,  serving: 28  },
  'trail mix':       { calories: 462, protein: 14,  carbs: 45, fat: 29,  saturatedFat: 5.5, sugar: 30,  fiber: 5,   sodium: 70,  serving: 40  },
  'popcorn':         { calories: 387, protein: 13,  carbs: 78, fat: 4.5, saturatedFat: 0.6, sugar: 0.9, fiber: 14.5,sodium: 8,   serving: 28  },
  'chips':           { calories: 536, protein: 7,   carbs: 53, fat: 35,  saturatedFat: 4.4, sugar: 0.4, fiber: 4.4, sodium: 525, serving: 28  },
  'crackers':        { calories: 502, protein: 7,   carbs: 61, fat: 25,  saturatedFat: 6.5, sugar: 7,   fiber: 2.3, sodium: 698, serving: 30  },
  'granola bar':     { calories: 471, protein: 8,   carbs: 64, fat: 20,  saturatedFat: 5,   sugar: 29,  fiber: 5,   sodium: 79,  serving: 42  },
};

// Names that resolve to on-device nutrition (used by the confirm/correct search).
export const OFFLINE_FOODS = Object.keys(HARDCODED).sort();

const r1 = (n) => Math.round(n * 10) / 10;

// Scale per-100g macros to a concrete portion (grams) and derive glycemic LOAD
// (GI × available carbs in the portion / 100). Pure — recompute whenever the
// portion changes. Note: the per-100g macros themselves are a database lookup,
// not measured from the image; this just scales them to the chosen portion.
export function applyPortion(food, grams) {
  const g = Math.max(0, Math.round(grams || 0));
  const f = g / 100;
  const carbsP = r1((food.carbs || 0) * f);
  return {
    portionGrams: g,
    caloriesPortion: Math.round((food.calories || 0) * f),
    proteinPortion: r1((food.protein || 0) * f),
    carbsPortion: carbsP,
    fatPortion: r1((food.fat || 0) * f),
    sugarPortion: r1((food.sugar || 0) * f),
    sodiumPortion: Math.round((food.sodium || 0) * f),
    glycemicLoad: food.gi != null ? Math.round((food.gi * carbsP) / 100) : null,
  };
}

// low <10, medium 10–19, high ≥20 (standard glycemic-load bands)
export function glCategory(gl) {
  if (gl == null) return null;
  if (gl < 10) return 'low';
  if (gl < 20) return 'medium';
  return 'high';
}

export function getNutritionOffline(foodName) {
  const key = foodName.toLowerCase().trim();
  let base = HARDCODED[key];
  if (!base) {
    // Fuzzy: longest table key contained in the query, so classifier dish names
    // still resolve (e.g. "hyderabadi biryani" -> "biryani", "cheeseburger" -> "burger").
    let bestKey = null;
    for (const k of Object.keys(HARDCODED)) {
      if (key.includes(k) && (!bestKey || k.length > bestKey.length)) bestKey = k;
    }
    if (bestKey) base = HARDCODED[bestKey];
  }
  if (!base) return null;
  const gi = lookupGI(foodName);
  const { serving, ...macros } = base;
  const out = {
    name: foodName,
    queryName: foodName,
    cholesterol: 0, potassium: 0, calcium: 0, iron: 0,
    ...macros,
    gi:         gi ? gi.value : null,
    giCategory: gi ? gi.category : null,
    giSource:   gi ? gi.source : 'offline',
  };
  if (serving != null) {
    out.portionGrams = serving;
    out.portionLabel = `typical serving (~${serving} g)`;
    out.caloriesPortion = Math.round((macros.calories || 0) * serving / 100);
  }
  return out;
}
