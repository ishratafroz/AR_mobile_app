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

// Interpret the user's last vitals/labs (fasting glucose, BP, resting pulse) into
// clinical categories + risk flags. Thresholds follow common clinical cutoffs
// (ADA fasting glucose; ACC/AHA blood pressure). Returns safe defaults if blank.
export function assessClinical(user) {
  const out = {
    glucoseCat: null, bpCat: null, pulseCat: null,
    diabetesRisk: false, hypertensionRisk: false, tachy: false,
  };
  if (!user) return out;

  const g = Number(user.glucose);
  if (g) {
    if (g >= 126)      { out.glucoseCat = 'diabetic range';    out.diabetesRisk = true; }
    else if (g >= 100) { out.glucoseCat = 'prediabetic range'; out.diabetesRisk = true; }
    else               { out.glucoseCat = 'normal'; }
  }

  const sys = Number(user.bpSystolic), dia = Number(user.bpDiastolic);
  if (sys || dia) {
    if (sys >= 140 || dia >= 90)      { out.bpCat = 'stage 2 hypertension'; out.hypertensionRisk = true; }
    else if (sys >= 130 || dia >= 80) { out.bpCat = 'stage 1 hypertension'; out.hypertensionRisk = true; }
    else if (sys >= 120)              { out.bpCat = 'elevated'; }
    else                              { out.bpCat = 'normal'; }
  }

  const p = Number(user.pulse);
  if (p) {
    if (p > 100)     { out.pulseCat = 'elevated'; out.tachy = true; }
    else if (p < 50) { out.pulseCat = 'low'; }
    else             { out.pulseCat = 'normal'; }
  }
  return out;
}

const LEVELS = ['safe', 'caution', 'danger'];
function escalate(level, steps = 1) {
  const i = LEVELS.indexOf(level);
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i + steps))];
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

// ---------------------------------------------------------------------------
// NUTRITION QUALITY — "is this nutritious enough?" (separate from health RISK).
// A food can be low-RISK but not NUTRITIOUS (white rice: safe yet mostly empty),
// or nutrient-dense (lentils, salmon). We score nutrient density per 100 g:
// protein + fiber count for, sugar + saturated fat + sodium count against, and a
// calorie-dense item with little protein/fiber is flagged as "empty calories".
export function assessNutritionQuality(n) {
  if (!n) return { qualityScore: 0, qualityLabel: 'Unknown', qualityTone: 'low', nutritious: false, qualityNote: '' };
  let q = 0;
  const good = [], bad = [];

  if (n.protein >= 10)      { q += 2; good.push('protein'); }
  else if (n.protein >= 5)  { q += 1; }
  if (n.fiber >= 5)         { q += 2; good.push('fiber'); }
  else if (n.fiber >= 2.5)  { q += 1; good.push('fiber'); }

  if (n.sugar >= 22.5)         { q -= 2; bad.push('sugar'); }
  else if (n.sugar >= 10)      { q -= 1; }
  if (n.saturatedFat >= 5)     { q -= 2; bad.push('saturated fat'); }
  if (n.sodium >= 600)         { q -= 1; bad.push('sodium'); }

  // calorie-dense but nutrient-poor → "empty calories"
  const emptyCal = n.calories >= 250 && n.protein < 5 && n.fiber < 2;
  if (emptyCal) { q -= 1; bad.push('little protein or fiber'); }

  let qualityLabel, qualityTone;
  if (q >= 3)       { qualityLabel = 'Nutritious';            qualityTone = 'good'; }
  else if (q >= 1)  { qualityLabel = 'Moderately nutritious'; qualityTone = 'ok'; }
  else if (q >= -1) { qualityLabel = 'Low nutrition';         qualityTone = 'low'; }
  else              { qualityLabel = 'Empty calories';        qualityTone = 'poor'; }

  let qualityNote;
  if (good.length && q >= 1) qualityNote = `Good source of ${good.join(' & ')}.`;
  else if (emptyCal)         qualityNote = 'Calorie-dense with little protein or fiber — not very nourishing.';
  else if (bad.length)       qualityNote = `Light on nutrients; watch the ${bad.join(' & ')}.`;
  else                       qualityNote = 'Modest nutritional value.';

  return { qualityScore: q, qualityLabel, qualityTone, nutritious: q >= 1, qualityNote };
}

// Maps the existing safe/caution/danger riskLevel into a personalized verdict.
function verdictFromRisk(riskLevel) {
  if (riskLevel === 'safe') return VERDICT.good;
  if (riskLevel === 'caution') return VERDICT.moderate;
  return VERDICT.risky;
}

// Builds a personalized recommendation that also reflects the user's day so far
// (history), how nutritious the item is (quality), and the user's vitals/labs
// (clinical).
function buildRecommendation(nutrition, base, user, allergens, alt, history, quality, clinical) {
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

  // Vitals/labs-specific colour (uses the numbers the user entered):
  if (clinical) {
    if (clinical.diabetesRisk && (nutrition.gi >= 56 || nutrition.sugar >= 10)) {
      parts.push(`Your last fasting sugar (${user.glucose} mg/dL, ${clinical.glucoseCat}) means this high-glycemic food can push it higher.`);
    }
    if (clinical.hypertensionRisk && nutrition.sodium >= 400) {
      parts.push(`Your last BP (${user.bpSystolic}/${user.bpDiastolic}, ${clinical.bpCat}) plus this ${nutrition.sodium} mg sodium is a concern — choose lower-salt.`);
    }
    if (clinical.tachy && nutrition.saturatedFat >= 5) {
      parts.push(`Your resting pulse (${user.pulse} bpm) is elevated; go easy on this saturated-fat-heavy item.`);
    }
  }

  // Is it nutritious enough? (quality is independent of risk)
  if (quality && quality.qualityNote) parts.push(quality.qualityNote);

  // Weight-aware nudge: an overweight/obese user gets a portion cue on
  // calorie-dense items even when nutrient risk alone reads "safe".
  const bmi = bmiOf(user);
  const consumedCals = nutrition.caloriesPortion != null ? nutrition.caloriesPortion : nutrition.calories;
  if (bmi != null && bmi >= 25 && consumedCals != null && consumedCals >= 250) {
    parts.push(`At a BMI of ${bmi}, keep the portion modest — this is ${consumedCals} kcal.`);
  }

  // History-aware: where this item leaves the user against today's goal.
  if (history && history.goal && consumedCals != null) {
    const projected = Math.round((history.caloriesToday || 0) + consumedCals);
    if (projected > history.goal) {
      parts.push(`This pushes you to ${projected}/${history.goal} kcal — over today's goal.`);
    } else {
      const left = history.goal - projected;
      parts.push(`Puts you at ${projected}/${history.goal} kcal today (${left} left).`);
    }
  }

  if (base.riskLevel !== 'safe' && alt) parts.push(`Try ${alt} instead.`);

  return parts.join(' ');
}

/**
 * Full personalized assessment. Combines nutrient risk (tuned to the user's
 * focus), wearable signals, the user's medical conditions, and allergies into a
 * single good / moderate / risky / avoid verdict plus a recommendation string.
 */
// `history` (optional): { caloriesToday, goal } — the user's running daily total
// before this item, so the recommendation can speak to their day, not just the food.
export function assessForUser(nutrition, healthMetrics, user, history = null) {
  const mode = deriveMode(user);
  const clinical = assessClinical(user);

  // Fold the user's manually-entered resting pulse into the metrics the risk
  // engine reads, so its HR-aware rules work even without a connected wearable.
  let metrics = healthMetrics;
  if (user?.pulse && (!metrics || metrics.restingHeartRate == null)) {
    metrics = { ...(metrics || {}), restingHeartRate: Number(user.pulse) };
  }

  const base = computeRisk(nutrition, metrics, mode);

  // Clinical escalation: the user's own labs make a borderline food riskier.
  if (clinical.diabetesRisk && (nutrition.gi >= 56 || nutrition.sugar >= 10)) {
    base.diabetesFlag = true;
    base.riskLevel = escalate(base.riskLevel, 1);
    if (!base.reasons.includes('your blood sugar')) base.reasons.unshift('your blood sugar');
  }
  if (clinical.hypertensionRisk && nutrition.sodium >= 400) {
    base.riskLevel = escalate(base.riskLevel, 1);
    if (!base.reasons.includes('your blood pressure')) base.reasons.unshift('your blood pressure');
  }

  const allergens = matchAllergens(nutrition, user?.allergies);
  const alt = suggestAlternative(nutrition?.queryName || nutrition?.name, base.riskLevel);
  const quality = assessNutritionQuality(nutrition);

  const v = allergens.length ? VERDICT.avoid : verdictFromRisk(base.riskLevel);
  const recommendation = buildRecommendation(nutrition, base, user, allergens, alt, history, quality, clinical);

  return {
    ...base,
    ...quality,
    mode,
    clinical,
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
