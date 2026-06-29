// Religion / dietary-tradition food-permissibility rules.
//
// WHY: recommendations must respect the user's faith. A Hindu user should never
// be told to eat beef; a Muslim user should see pork/non-halal items flagged; a
// Jain user should see onion/garlic/root vegetables flagged, etc. This is a
// keyword filter over the recognized food NAME (the same approach the allergen
// matcher uses) — it doesn't claim certification, it surfaces a clear cultural
// flag plus a permissible alternative so the user can decide.
//
// Each rule:
//   forbid : keywords that imply a restricted food (matched as substrings)
//   reason : short human explanation shown in the recommendation
//   alt    : a permissible swap suggestion (optional)

const BEEF      = ['beef', 'steak', 'cow', 'veal', 'burger', 'cheeseburger', 'hamburger', 'meatball', 'brisket', 'roast beef'];
const PORK      = ['pork', 'ham', 'bacon', 'sausage', 'pepperoni', 'salami', 'hot dog', 'gammon', 'prosciutto', 'lard', 'chorizo'];
const SHELLFISH = ['shrimp', 'prawn', 'crab', 'lobster', 'clam', 'oyster', 'squid', 'scallop', 'mussel'];
const MEAT      = ['chicken', 'beef', 'pork', 'mutton', 'lamb', 'goat', 'fish', 'meat', 'bacon', 'ham', 'sausage', 'steak',
                   'turkey', 'duck', 'shrimp', 'prawn', 'crab', 'hot dog', 'pepperoni', 'salami', 'burger', 'wings', 'kebab'];
const ANIMAL    = [...MEAT, 'egg', 'omelette', 'omelet', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt',
                   'paneer', 'ghee', 'honey', 'ice cream', 'custard', 'mayonnaise'];
const ALCOHOL   = ['beer', 'wine', 'rum', 'whiskey', 'vodka', 'liquor', 'cocktail', 'champagne'];
const JAIN_ROOT = ['onion', 'garlic', 'potato', 'carrot', 'radish', 'beet', 'ginger', 'turnip'];

export const RELIGION_RULES = {
  none: [],
  hindu: [
    { forbid: BEEF, reason: 'Beef is avoided in Hinduism (the cow is sacred)', alt: 'grilled chicken or paneer' },
  ],
  muslim: [
    { forbid: PORK,    reason: 'Pork and its products are haram (forbidden) in Islam', alt: 'grilled chicken or fish' },
    { forbid: ALCOHOL, reason: 'Alcohol is haram in Islam', alt: 'sparkling water' },
  ],
  jewish: [
    { forbid: PORK,      reason: 'Pork is not kosher', alt: 'grilled chicken or beef' },
    { forbid: SHELLFISH, reason: 'Shellfish is not kosher', alt: 'baked fish (with fins & scales)' },
  ],
  jain: [
    { forbid: MEAT,      reason: 'Jainism follows strict non-violence (no meat/fish/egg)', alt: 'dal, lentils or paneer' },
    { forbid: ['egg', 'omelette', 'omelet'], reason: 'Eggs are avoided in Jainism', alt: 'tofu or paneer' },
    { forbid: JAIN_ROOT, reason: 'Root vegetables (onion, garlic, potato…) are avoided in Jainism', alt: 'leafy vegetables or lentils' },
  ],
  buddhist: [
    { forbid: MEAT, reason: 'Many Buddhists follow a vegetarian diet', alt: 'tofu, lentils or vegetables' },
  ],
  christian: [],
  vegetarian: [
    { forbid: MEAT, reason: 'Contains meat/fish — not vegetarian', alt: 'paneer, beans, lentils or tofu' },
  ],
  vegan: [
    { forbid: ANIMAL, reason: 'Contains an animal product — not vegan', alt: 'tofu, beans, lentils or vegetables' },
  ],
};

// Returns the matching restriction for a food under a religion, or null.
// Looks at the recognized name + query name + any "also detected" guesses.
export function matchReligiousRestriction(nutrition, religion) {
  if (!religion || religion === 'none' || !nutrition) return null;
  const rules = RELIGION_RULES[religion];
  if (!rules || !rules.length) return null;
  const hay = [nutrition.name, nutrition.queryName, ...(nutrition.alsoDetected || [])]
    .filter(Boolean).join(' ').toLowerCase();
  for (const rule of rules) {
    const hit = rule.forbid.find(k => hay.includes(k));
    if (hit) return { matched: hit, reason: rule.reason, alt: rule.alt, religion };
  }
  return null;
}
