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
// Used by the "Pick Food from list" path when the scan/network fails.
const HARDCODED = {
  'pizza':           { calories: 266, protein: 11, carbs: 33, fat: 10,  saturatedFat: 4.5, sugar: 3.6, fiber: 2.3, sodium: 598 },
  'noodles':         { calories: 138, protein: 4.5, carbs: 25, fat: 2.1, saturatedFat: 0.4, sugar: 0.6, fiber: 1.2, sodium: 5 },
  'instant noodles': { calories: 436, protein: 9,   carbs: 60, fat: 17,  saturatedFat: 7.5, sugar: 2.5, fiber: 2.5, sodium: 1731 },
  'biryani':         { calories: 290, protein: 8,   carbs: 35, fat: 13,  saturatedFat: 4,   sugar: 2,   fiber: 1.5, sodium: 480 },
  'burger':          { calories: 295, protein: 17,  carbs: 24, fat: 14,  saturatedFat: 5,   sugar: 5,   fiber: 1.5, sodium: 414 },
  'grilled chicken': { calories: 165, protein: 31,  carbs: 0,  fat: 3.6, saturatedFat: 1,   sugar: 0,   fiber: 0,   sodium: 74  },
  'salad':           { calories: 33,  protein: 1.4, carbs: 6,  fat: 0.2, saturatedFat: 0,   sugar: 2,   fiber: 2,   sodium: 18  },
  'rice':            { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, saturatedFat: 0,   sugar: 0,   fiber: 0.4, sodium: 1   },
  'french fries':    { calories: 312, protein: 3.4, carbs: 41, fat: 15,  saturatedFat: 2.3, sugar: 0.3, fiber: 3.8, sodium: 210 },
  'donut':           { calories: 452, protein: 4.9, carbs: 51, fat: 25,  saturatedFat: 6.5, sugar: 23,  fiber: 1.4, sodium: 326 },
  'apple':           { calories: 52,  protein: 0.3, carbs: 14, fat: 0.2, saturatedFat: 0,   sugar: 10,  fiber: 2.4, sodium: 1   },
  'banana':          { calories: 89,  protein: 1.1, carbs: 23, fat: 0.3, saturatedFat: 0,   sugar: 12,  fiber: 2.6, sodium: 1   },
};

export function getNutritionOffline(foodName) {
  const key = foodName.toLowerCase().trim();
  const base = HARDCODED[key];
  if (!base) return null;
  const gi = lookupGI(foodName);
  return {
    name: foodName,
    queryName: foodName,
    cholesterol: 0, potassium: 0, calcium: 0, iron: 0,
    ...base,
    gi:         gi ? gi.value : null,
    giCategory: gi ? gi.category : null,
    giSource:   gi ? gi.source : 'offline',
  };
}
