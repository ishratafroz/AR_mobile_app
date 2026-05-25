// Curated glycemic index (GI) lookup, ~100 common foods.
// Sources: University of Sydney GI database, Harvard Health, Diabetes UK.
// Values are typical mid-points; real GI varies with cooking, ripeness, processing.

const GI_TABLE = {
  // grains / breads
  'white bread':            75,
  'whole wheat bread':      69,
  'sourdough bread':        54,
  'bagel':                  72,
  'tortilla':               30,
  'pita bread':             57,
  'naan':                   62,
  'roti':                   62,
  'chapati':                52,

  // rice / pasta / noodles
  'white rice':             73,
  'brown rice':             68,
  'basmati rice':           58,
  'jasmine rice':           86,
  'sushi rice':             83,
  'biryani':                60,
  'fried rice':             75,
  'rice pilaf':             65,
  'pasta':                  49,
  'spaghetti':              46,
  'macaroni':               47,
  'noodles':                47,
  'instant noodles':        67,
  'ramen':                  65,
  'udon':                   62,
  'rice noodles':           61,

  // breakfast cereals / oats
  'oatmeal':                55,
  'porridge':               55,
  'rolled oats':            55,
  'steel cut oats':         42,
  'cornflakes':             81,
  'muesli':                 56,
  'granola':                50,

  // potatoes / starchy veg
  'potato':                 78,
  'boiled potato':          78,
  'baked potato':           85,
  'mashed potato':          83,
  'french fries':           75,
  'sweet potato':           63,
  'yam':                    51,
  'cassava':                46,
  'corn':                   52,

  // legumes
  'lentils':                32,
  'dal':                    32,
  'chickpeas':              28,
  'kidney beans':           24,
  'black beans':            30,
  'soybeans':               15,
  'tofu':                   15,
  'hummus':                 6,

  // fruits
  'apple':                  36,
  'banana':                 51,
  'orange':                 43,
  'grapes':                 53,
  'watermelon':             76,
  'pineapple':              66,
  'mango':                  51,
  'strawberry':             40,
  'cherry':                 22,
  'pear':                   38,
  'peach':                  42,
  'grapefruit':             25,

  // dairy
  'milk':                   31,
  'whole milk':             31,
  'skim milk':              32,
  'yogurt':                 41,
  'greek yogurt':           11,
  'ice cream':              57,
  'cheese':                 0,
  'butter':                 0,

  // meat / protein (negligible GI)
  'chicken':                0,
  'grilled chicken':        0,
  'chicken breast':         0,
  'beef':                   0,
  'pork':                   0,
  'fish':                   0,
  'salmon':                 0,
  'tuna':                   0,
  'shrimp':                 0,
  'egg':                    0,
  'eggs':                   0,

  // common dishes
  'pizza':                  60,
  'burger':                 66,
  'hamburger':              66,
  'cheeseburger':           66,
  'hot dog':                28,
  'sandwich':               55,
  'taco':                   58,
  'burrito':                64,
  'sushi':                  55,
  'salad':                  15,
  'caesar salad':           20,
  'soup':                   30,
  'chicken soup':           28,
  'curry':                  45,
  'biryani':                60,
  'fried chicken':          70,
  'kebab':                  35,

  // sweets / snacks
  'donut':                  76,
  'doughnut':               76,
  'cake':                   67,
  'chocolate cake':         70,
  'cookie':                 64,
  'chocolate':              40,
  'dark chocolate':         23,
  'candy':                  78,
  'gummy bears':            80,
  'popcorn':                65,
  'chips':                  56,
  'pretzels':               83,
  'crackers':               74,

  // drinks
  'orange juice':           50,
  'apple juice':            41,
  'coke':                   63,
  'soda':                   63,
  'beer':                   89,
};

export function classifyGI(gi) {
  if (gi === 0) return 'none';
  if (gi <= 55) return 'low';
  if (gi <= 69) return 'medium';
  return 'high';
}

export function lookupGI(foodName) {
  if (!foodName) return null;
  const q = foodName.toLowerCase().trim();

  // exact match
  if (GI_TABLE[q] !== undefined) {
    const value = GI_TABLE[q];
    return { value, category: classifyGI(value), source: 'exact' };
  }

  // word-overlap match: pick the table entry sharing the most words with the query
  const qWords = new Set(q.split(/\s+/));
  let best = null;
  let bestScore = 0;
  for (const key of Object.keys(GI_TABLE)) {
    const kWords = key.split(/\s+/);
    let score = 0;
    for (const w of kWords) {
      if (qWords.has(w)) score++;
      else if (q.includes(w)) score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  if (best && bestScore > 0) {
    const value = GI_TABLE[best];
    return { value, category: classifyGI(value), source: `matched "${best}"` };
  }
  return null;
}

export const COMMON_FOODS = Object.keys(GI_TABLE)
  .filter(k => GI_TABLE[k] > 0)
  .sort();
