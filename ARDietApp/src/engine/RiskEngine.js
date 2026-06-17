// Diet risk engine. Combines FSA traffic-light nutrient thresholds with
// diabetes-specific signals (high GI + high sugar). Goal 2 will add wearable
// data (HR, steps) via the optional `healthMetrics` param.
//
// Thresholds are loosely based on UK FSA front-of-pack labelling for solid foods.

const HIGH = { fat: 17.5, saturatedFat: 5, sugar: 22.5, sodium: 600 };
const MED  = { fat: 3,    saturatedFat: 1.5, sugar: 5,  sodium: 120 };

// Use-case profiles (Goal 3) bias the scoring toward the condition being managed.
// `w` = extra weight multipliers; `giHigh`/`sugarHigh` = stricter thresholds.
const PROFILE_TUNING = {
  general:  { satFatW: 1, sodiumW: 1, sugarW: 1, giW: 1, giHighAt: 70, sugarHighAt: 22.5 },
  diabetic: { satFatW: 1, sodiumW: 1, sugarW: 2, giW: 2, giHighAt: 56, sugarHighAt: 12 },
  cardiac:  { satFatW: 2, sodiumW: 2, sugarW: 1, giW: 1, giHighAt: 70, sugarHighAt: 22.5 },
  fitness:  { satFatW: 1, sodiumW: 1, sugarW: 1, giW: 1, giHighAt: 70, sugarHighAt: 22.5 },
};

export function computeRisk(nutrition, healthMetrics = null, profile = 'general') {
  if (!nutrition) return { riskLevel: 'safe', riskMessage: 'No data', reasons: [], score: 0, diabetesFlag: false };

  const t = PROFILE_TUNING[profile] || PROFILE_TUNING.general;
  const reasons = [];
  let score = 0;

  // --- nutrient-based risk (general cardiovascular) ---
  if (nutrition.saturatedFat >= HIGH.saturatedFat) { score += 2 * t.satFatW; reasons.push('high sat fat'); }
  else if (nutrition.saturatedFat >= MED.saturatedFat) { score += 1 * t.satFatW; }

  if (nutrition.sugar >= t.sugarHighAt) { score += 2 * t.sugarW; reasons.push('high sugar'); }
  else if (nutrition.sugar >= MED.sugar) { score += 1 * t.sugarW; }

  if (nutrition.sodium >= HIGH.sodium) { score += 2 * t.sodiumW; reasons.push('high sodium'); }
  else if (nutrition.sodium >= MED.sodium) { score += 1 * t.sodiumW; }

  if (nutrition.fat >= HIGH.fat) { score += 1; reasons.push('high fat'); }

  // --- diabetes-specific signal (GI + sugar + activity) ---
  let diabetesFlag = false;
  const giHigh = nutrition.gi != null && nutrition.gi >= t.giHighAt;
  const giMed  = nutrition.gi != null && nutrition.gi >= 56 && nutrition.gi < t.giHighAt;

  if (giHigh) {
    score += 2 * t.giW;
    reasons.push(`high GI (${nutrition.gi})`);
    diabetesFlag = true;
  } else if (giMed) {
    score += 1 * t.giW;
    if (profile === 'diabetic') diabetesFlag = true;
  }

  // --- fitness profile: flag low protein density on a calorie-heavy item ---
  if (profile === 'fitness' && nutrition.calories >= 200 && nutrition.protein < 8) {
    score += 1;
    reasons.push('low protein');
  }

  // Wearable-aware escalation (Goal 2 - optional, only fires if metrics passed in)
  if (healthMetrics) {
    const { restingHeartRate, stepsToday, sleepHours } = healthMetrics;

    if (restingHeartRate != null && restingHeartRate > 90 && nutrition.saturatedFat >= MED.saturatedFat) {
      score += 1;
      reasons.push('elevated HR + sat fat');
    }
    if (stepsToday != null && stepsToday < 3000 && (giHigh || nutrition.sugar >= HIGH.sugar)) {
      score += 2;
      reasons.push('low activity + high glycemic load');
      diabetesFlag = true;
    }
    if (sleepHours != null && sleepHours < 5 && nutrition.sugar >= MED.sugar) {
      score += 1;
      reasons.push('poor sleep + sugar');
    }
  }

  let riskLevel, riskMessage;
  if (score >= 5) {
    riskLevel = 'danger';
    riskMessage = reasons.slice(0, 2).join(', ') || 'Multiple risks';
  } else if (score >= 2) {
    riskLevel = 'caution';
    riskMessage = reasons[0] || 'Moderate concern';
  } else {
    riskLevel = 'safe';
    riskMessage = 'Within healthy range';
  }

  return { riskLevel, riskMessage, reasons, score, diabetesFlag };
}

// ---------------------------------------------------------------------------
// PERSONALIZED RECOMMENDATION LAYER (takes full user health info)
// ---------------------------------------------------------------------------
// Maps an allergy to the food-name keywords that imply it. Matched against the
// recognized food name (+ any "also detected" guesses) to raise a hard AVOID.
const ALLERGEN_KEYWORDS = {
  nuts:      ['nut', 'peanut', 'almond', 'cashew', 'walnut', 'pistachio', 'pecan', 'hazelnut', 'praline', 'macadamia'],
  dairy:     ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'custard', 'paneer', 'ghee', 'ice cream'],
  gluten:    ['bread', 'wheat', 'pasta', 'noodle', 'flour', 'cake', 'cookie', 'pizza', 'bagel', 'muffin', 'cracker',
              'roti', 'naan', 'chapati', 'paratha', 'toast', 'croissant', 'pancake', 'waffle', 'cereal', 'biscuit', 'spaghetti', 'macaroni'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'clam', 'oyster', 'squid', 'scallop'],
  egg:       ['egg', 'omelette', 'omelet', 'mayonnaise', 'meringue'],
  soy:       ['soy', 'tofu', 'edamame', 'miso', 'tempeh'],
};

// Which risk-engine tuning a user's focus maps to.
export function deriveMode(user) {
  return (user && user.focus) || 'general';
}

// Body-mass index from the intake profile (kg / m^2). Null if height/weight missing.
export function bmiOf(user) {
  const h = parseFloat(user?.heightCm), w = parseFloat(user?.weightKg);
  if (!h || !w) return null;
  return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
}

// Returns the list of the user's allergens that this food appears to contain.
export function matchAllergens(nutrition, allergies) {
  if (!allergies || !allergies.length || !nutrition) return [];
  const hay = [nutrition.name, nutrition.queryName, ...(nutrition.alsoDetected || [])]
    .filter(Boolean).join(' ').toLowerCase();
  const hits = [];
  for (const a of allergies) {
    const kws = ALLERGEN_KEYWORDS[a] || [a];
    if (kws.some(k => hay.includes(k))) hits.push(a);
  }
  return hits;
}

const VERDICT = {
  good:     { key: 'good',     label: 'GOOD FOR YOU' },
  moderate: { key: 'moderate', label: 'OK IN MODERATION' },
  risky:    { key: 'risky',    label: 'RISKY FOR YOU' },
  avoid:    { key: 'avoid',    label: 'AVOID' },
};

// Maps the existing safe/caution/danger riskLevel into a personalized verdict.
function verdictFromRisk(riskLevel) {
  if (riskLevel === 'safe') return VERDICT.good;
  if (riskLevel === 'caution') return VERDICT.moderate;
  return VERDICT.risky;
}

// Builds a one-or-two sentence personalized recommendation.
function buildRecommendation(nutrition, base, user, allergens, alt) {
  if (allergens.length) {
    const list = allergens.join(' & ');
    return `Contains ${list}. You listed a ${list} allergy — do not eat this.`;
  }

  const mode = deriveMode(user);
  const parts = [];

  if (base.riskLevel === 'safe') {
    parts.push('Good choice — this fits your plan.');
    if (mode === 'fitness' && nutrition.protein >= 15) parts.push(`Solid ${Math.round(nutrition.protein)} g protein.`);
  } else if (base.riskLevel === 'caution') {
    parts.push(`Okay in moderation — watch the ${base.reasons[0] || 'portion'}.`);
  } else {
    parts.push(`Risky for you: ${base.reasons.slice(0, 2).join(', ') || 'multiple factors'}.`);
  }

  // Condition-specific colour:
  const cond = user?.conditions || [];
  if (cond.includes('diabetes') && (base.diabetesFlag || nutrition.gi >= 56)) {
    parts.push(`High glycemic load can spike blood sugar — keep the portion small.`);
  }
  if ((cond.includes('hypertension') || cond.includes('heart')) && nutrition.sodium >= 600) {
    parts.push(`High sodium (${nutrition.sodium} mg) — a concern for your blood pressure/heart.`);
  }
  if (cond.includes('cholesterol') && nutrition.saturatedFat >= 5) {
    parts.push(`High saturated fat (${nutrition.saturatedFat} g) raises cholesterol.`);
  }

  // Weight-aware nudge: an overweight/obese user gets a portion cue on
  // calorie-dense items even when nutrient risk alone reads "safe".
  const bmi = bmiOf(user);
  const consumedCals = nutrition.caloriesPortion != null ? nutrition.caloriesPortion : nutrition.calories;
  if (bmi != null && bmi >= 25 && consumedCals != null && consumedCals >= 250) {
    parts.push(`At a BMI of ${bmi}, keep the portion modest — this is ${consumedCals} kcal.`);
  }

  if (base.riskLevel !== 'safe' && alt) parts.push(`Try ${alt} instead.`);

  return parts.join(' ');
}

/**
 * Full personalized assessment. Combines nutrient risk (tuned to the user's
 * focus), wearable signals, the user's medical conditions, and allergies into a
 * single good / moderate / risky / avoid verdict plus a recommendation string.
 */
export function assessForUser(nutrition, healthMetrics, user) {
  const mode = deriveMode(user);
  const base = computeRisk(nutrition, healthMetrics, mode);
  const allergens = matchAllergens(nutrition, user?.allergies);
  const alt = suggestAlternative(nutrition?.queryName || nutrition?.name, base.riskLevel);

  const v = allergens.length ? VERDICT.avoid : verdictFromRisk(base.riskLevel);
  const recommendation = buildRecommendation(nutrition, base, user, allergens, alt);

  return {
    ...base,
    mode,
    allergens,
    alternative: alt,
    verdict: v.key,
    verdictLabel: v.label,
    recommendation,
  };
}

// Healthier-alternative suggestion (Goal 2). Triggered when riskLevel != safe.
const SWAP_TABLE = {
  'white bread':      'whole wheat bread',
  'white rice':       'brown rice',
  'jasmine rice':     'basmati rice',
  'french fries':     'baked sweet potato',
  'instant noodles':  'whole wheat pasta',
  'donut':            'apple',
  'doughnut':         'apple',
  'cake':             'greek yogurt with berries',
  'chocolate cake':   'dark chocolate (small)',
  'soda':             'sparkling water',
  'coke':             'sparkling water',
  'cornflakes':       'steel cut oats',
  'fried chicken':    'grilled chicken',
  'french fries':     'baked potato',
  'pizza':            'whole wheat veggie wrap',
  'burger':           'grilled chicken sandwich',
  'cheeseburger':     'grilled chicken sandwich',
  'ice cream':        'greek yogurt',
  'candy':            'fresh fruit',
  'chips':            'air-popped popcorn',
};

export function suggestAlternative(foodName, riskLevel) {
  if (riskLevel === 'safe') return null;
  const key = (foodName || '').toLowerCase().trim();
  for (const [bad, good] of Object.entries(SWAP_TABLE)) {
    if (key.includes(bad)) return good;
  }
  return null;
}
