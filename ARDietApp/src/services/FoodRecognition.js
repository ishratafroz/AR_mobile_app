import { GOOGLE_VISION_API_KEY } from '../constants/APIKeys';

export async function fileUrlToBase64(fileUrl) {
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      const result = reader.result;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.substring(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

// Curated list of generic non-food labels Vision often returns that we should ignore
const NON_FOOD_LABELS = new Set([
  'food', 'cuisine', 'dish', 'ingredient', 'recipe', 'meal',
  'tableware', 'dishware', 'plate', 'bowl', 'cup', 'cutlery',
  'table', 'wood', 'fast food', 'staple food', 'comfort food',
  'breakfast', 'lunch', 'dinner', 'snack',
]);

export async function identifyFood(base64Image) {
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY.startsWith('PASTE_')) {
    throw new Error('Google Vision API key not set in src/constants/APIKeys.js');
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 15 },
          { type: 'WEB_DETECTION',   maxResults: 10 },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision HTTP ${res.status}: ${text.substring(0, 200)}`);
  }

  const data = await res.json();
  const r = data?.responses?.[0] || {};

  // Web detection's bestGuessLabels are often the most specific (e.g., "chicken biryani")
  const guesses = [];
  for (const g of r.webDetection?.bestGuessLabels ?? []) {
    if (g.label) guesses.push({ name: g.label, confidence: 1.0 });
  }
  for (const e of r.webDetection?.webEntities ?? []) {
    if (e.description && e.score) guesses.push({ name: e.description, confidence: e.score });
  }
  for (const l of r.labelAnnotations ?? []) {
    guesses.push({ name: l.description, confidence: l.score });
  }

  // Filter out generic non-food labels
  const foods = guesses.filter(g => !NON_FOOD_LABELS.has(g.name.toLowerCase()));

  if (!foods.length) throw new Error('No food labels detected');
  return foods;
}
