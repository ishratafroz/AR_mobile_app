// Region / cuisine bias for on-device food recognition.
//
// WHY: the SCAN models are a single GLOBAL classifier (AIY Food V1, 2,024 mostly
// Western/popular dishes) + a 16-class box detector. A global model can't reliably
// name a *non-popular regional* dish from pixels without per-region fine-tuning —
// that's a real limitation, not a bug. We can't fix recognition itself here, but we
// can make the app usable across cuisines two cheap ways:
//   1) bias the candidate ranking toward the user's selected cuisine (App.mergeCandidates),
//   2) surface that cuisine's common dishes as one-tap quick-picks in the confirm
//      step, so even a missed regional dish is one tap to correct (with real nutrition).
//
// Every food listed below resolves in the offline nutrition table (getNutritionOffline),
// so a quick-pick always yields macros — no dead taps.

export const REGIONS = [
  {
    key: 'global', label: 'Global', icon: '🌍',
    foods: ['pizza', 'burger', 'salad', 'rice', 'grilled chicken', 'sandwich', 'apple', 'banana'],
  },
  {
    key: 'south_asian', label: 'South Asian', icon: '🇮🇳',
    foods: ['biryani', 'naan', 'roti', 'chapati', 'paratha', 'samosa', 'dal', 'curry',
            'paneer', 'lentils', 'chickpeas', 'rice', 'mango', 'yogurt'],
  },
  {
    key: 'east_asian', label: 'East Asian', icon: '🥢',
    foods: ['noodles', 'ramen', 'sushi', 'fried rice', 'tofu', 'edamame', 'tempeh',
            'rice', 'soup', 'instant noodles'],
  },
  {
    key: 'middle_eastern', label: 'Middle East / Med', icon: '🥙',
    foods: ['hummus', 'chickpeas', 'lentils', 'bread', 'salad', 'rice', 'grilled chicken', 'fish'],
  },
  {
    key: 'latin', label: 'Latin American', icon: '🌮',
    foods: ['taco', 'burrito', 'beans', 'rice', 'grilled chicken', 'fish', 'salad'],
  },
  {
    key: 'western', label: 'Western', icon: '🍔',
    foods: ['pizza', 'burger', 'sandwich', 'french fries', 'hot dog', 'pasta', 'spaghetti',
            'salad', 'grilled chicken', 'fried chicken', 'bread'],
  },
];

const BY_KEY = Object.fromEntries(REGIONS.map(r => [r.key, r]));

export function getRegion(key) {
  return BY_KEY[key] || BY_KEY.global;
}

// Foods to offer as quick-pick chips for a region (de-duplicated, in list order).
export function regionFoods(key) {
  return getRegion(key).foods;
}

// Does a recognized candidate name belong to the selected cuisine? Uses substring
// matching so long classifier names still hit (e.g. "chicken biryani" → "biryani").
export function isRegionFood(name, key) {
  if (!key || key === 'global') return false;
  const n = String(name || '').toLowerCase();
  return getRegion(key).foods.some(f => n.includes(f) || f.includes(n));
}
