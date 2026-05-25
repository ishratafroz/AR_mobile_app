// ─────────────────────────────────────────────────────────────────────────────
// RiskEngine.js  –  Goal 2
// Computes a personalised health risk score by combining:
//   • Nutritional values from a scanned meal (Goal 1 output)
//   • Real-time physiological metrics from wearables (HealthKit / Google Fit)
//
// Three risk profiles are evaluated in parallel:
//   1. Cardiovascular  – saturated fat + sodium + resting heart rate
//   2. Diabetes / glycaemic – sugar + refined carbs + activity level
//   3. Fitness / macro – macro target adherence relative to daily goals
//
// Returns a RiskResult with an overall score, per-profile breakdown,
// food-level flags, and alternative food suggestions.
// ─────────────────────────────────────────────────────────────────────────────

import { FOOD_ALTERNATIVES } from './FoodAlternatives';

// ─────────────────────────────────────────────────────────────────────────────
// Risk thresholds
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  cardiovascular: {
    // Per-meal thresholds (g or mg)
    saturatedFat_high:   7,    // g  – AHA per-meal guideline
    saturatedFat_caution: 4,   // g
    sodium_high:         600,  // mg – AHA per-meal guideline
    sodium_caution:      400,  // mg
    // Resting heart rate (bpm)
    restingHR_high:      85,
    restingHR_caution:   75,
    // Score weights (must sum to 1.0)
    w_satFat:   0.40,
    w_sodium:   0.30,
    w_hr:       0.30,
  },
  diabetes: {
    sugar_high:         25,   // g per meal
    sugar_caution:      15,   // g
    refinedCarbs_high:  60,   // g per meal (carbs - fibre approximation)
    refinedCarbs_caution: 35, // g
    steps_low:        3000,   // steps today
    steps_moderate:   7500,
    w_sugar:      0.40,
    w_refinedCarbs: 0.35,
    w_activity:   0.25,
  },
  fitness: {
    // Daily macro targets (user-configurable; defaults below)
    default_calories: 2200,
    default_protein:  130,   // g
    default_carbs:    250,   // g
    default_fat:       70,   // g
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeRiskScore
 *
 * @param {object} nutrition  – NutritionSummary from NutritionAPI
 *   { calories, protein, carbs, fat, saturatedFat, sugar, sodium, fibre }
 *
 * @param {object|null} wearable  – WearableMetrics from HealthKit/GoogleFit
 *   { heartRate, restingHeartRate, steps, caloriesBurned, sleepHours, hrv }
 *
 * @param {object|null} userProfile  – Optional user daily targets
 *   { dailyCalories, dailyProtein, dailyCarbs, dailyFat, profileType }
 *   profileType: 'cardiovascular' | 'diabetes' | 'fitness' | 'general'
 *
 * @returns {RiskResult}
 */
export function computeRiskScore(nutrition, wearable = null, userProfile = null) {
  if (!nutrition) {
    return safeResult('Unable to assess risk — no nutrition data');
  }

  const w = wearable ?? {};
  const p = userProfile ?? {};

  // ─── Profile 1: Cardiovascular ──────────────────────────────────────────
  const cardioScore = computeCardiovascularScore(nutrition, w);

  // ─── Profile 2: Diabetes ────────────────────────────────────────────────
  const diabetesScore = computeDiabetesScore(nutrition, w);

  // ─── Profile 3: Fitness ─────────────────────────────────────────────────
  const fitnessScore = computeFitnessScore(nutrition, p);

  // ─── Composite score (highest risk drives the overall level) ────────────
  const scores = [cardioScore, diabetesScore, fitnessScore];
  const overall = weightedComposite(scores);

  // ─── Per-food risk flags ─────────────────────────────────────────────────
  const flags = buildFoodFlags(nutrition, cardioScore, diabetesScore);

  // ─── Top-level result ────────────────────────────────────────────────────
  const { level, message } = resolveLevel(overall);

  return {
    score:          overall,       // 0–100 (100 = highest risk)
    level,                         // 'safe' | 'caution' | 'danger'
    message,                       // Short AR display string
    profiles: {
      cardiovascular: cardioScore,
      diabetes:       diabetesScore,
      fitness:        fitnessScore,
    },
    flags,                         // Array of FoodFlag for AR highlight
    alternatives: getAlternatives(flags),
    hasWearableData: !!wearable,
  };
}

/**
 * computeRiskForPlate
 * Aggregated risk for a full plate from Goal 1 multi-scan.
 *
 * @param {NutritionResult[]} nutritionResults
 * @param {object|null} wearable
 * @returns {RiskResult[]}  – one per item, same order
 */
export function computeRiskForPlate(nutritionResults, wearable) {
  return nutritionResults.map(r =>
    computeRiskScore(r?.summary ?? null, wearable)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile calculators
// ─────────────────────────────────────────────────────────────────────────────

function computeCardiovascularScore(nutrition, wearable) {
  const t = THRESHOLDS.cardiovascular;

  // Saturated fat sub-score (0–100)
  const satFatScore = clampedScore(
    nutrition.saturatedFat,
    t.saturatedFat_caution,
    t.saturatedFat_high
  );

  // Sodium sub-score
  const sodiumScore = clampedScore(
    nutrition.sodium,
    t.sodium_caution,
    t.sodium_high
  );

  // Heart rate sub-score (0 if no wearable)
  const hr = wearable?.restingHeartRate ?? wearable?.heartRate ?? 0;
  const hrScore = hr > 0
    ? clampedScore(hr, t.restingHR_caution, t.restingHR_high)
    : 0;

  // Weighted composite
  const score = wearable
    ? t.w_satFat * satFatScore + t.w_sodium * sodiumScore + t.w_hr * hrScore
    : (t.w_satFat + t.w_sodium) / (t.w_satFat + t.w_sodium) *
      (t.w_satFat * satFatScore + t.w_sodium * sodiumScore);

  const rounded = Math.round(score);
  const { level, message } = resolveLevel(rounded, 'cardiovascular');

  return {
    score: rounded,
    level,
    message,
    breakdown: {
      saturatedFat: { value: nutrition.saturatedFat, score: Math.round(satFatScore), unit: 'g' },
      sodium:       { value: nutrition.sodium,       score: Math.round(sodiumScore), unit: 'mg' },
      heartRate:    { value: hr || 'N/A',            score: Math.round(hrScore),     unit: 'bpm' },
    },
  };
}

function computeDiabetesScore(nutrition, wearable) {
  const t = THRESHOLDS.diabetes;

  // Sugar sub-score
  const sugarScore = clampedScore(
    nutrition.sugar,
    t.sugar_caution,
    t.sugar_high
  );

  // Refined carbs ≈ total carbs − fibre
  const refinedCarbs = Math.max(0, (nutrition.carbs ?? 0) - (nutrition.fibre ?? 0));
  const carbScore    = clampedScore(
    refinedCarbs,
    t.refinedCarbs_caution,
    t.refinedCarbs_high
  );

  // Activity sub-score (inverse – more steps = lower risk)
  const steps = wearable?.steps ?? 0;
  const activityScore = steps > 0
    ? reverseClampedScore(steps, t.steps_moderate, t.steps_low)
    : 50;   // unknown activity → neutral

  const score = t.w_sugar * sugarScore + t.w_refinedCarbs * carbScore
              + t.w_activity * activityScore;
  const rounded = Math.round(score);
  const { level, message } = resolveLevel(rounded, 'diabetes');

  return {
    score: rounded,
    level,
    message,
    breakdown: {
      sugar:       { value: nutrition.sugar,  score: Math.round(sugarScore), unit: 'g' },
      refinedCarbs:{ value: refinedCarbs,     score: Math.round(carbScore),  unit: 'g' },
      activity:    { value: steps || 'N/A',   score: Math.round(activityScore), unit: 'steps' },
    },
  };
}

function computeFitnessScore(nutrition, profile) {
  const t = THRESHOLDS.fitness;
  const targets = {
    calories: profile.dailyCalories ?? t.default_calories,
    protein:  profile.dailyProtein  ?? t.default_protein,
    carbs:    profile.dailyCarbs    ?? t.default_carbs,
    fat:      profile.dailyFat      ?? t.default_fat,
  };

  // Meal should be ~30% of daily total for a 3-meal plan
  const MEAL_FRACTION = 0.30;
  const mealTargets = {
    calories: targets.calories * MEAL_FRACTION,
    protein:  targets.protein  * MEAL_FRACTION,
    carbs:    targets.carbs    * MEAL_FRACTION,
    fat:      targets.fat      * MEAL_FRACTION,
  };

  // For fitness, "risk" means how far off the targets you are (either over or under)
  const deviations = {
    calories: Math.abs(nutrition.calories - mealTargets.calories) / mealTargets.calories,
    protein:  Math.abs(nutrition.protein  - mealTargets.protein)  / mealTargets.protein,
    carbs:    Math.abs(nutrition.carbs    - mealTargets.carbs)    / mealTargets.carbs,
    fat:      Math.abs(nutrition.fat      - mealTargets.fat)      / mealTargets.fat,
  };

  const avgDeviation = Object.values(deviations).reduce((a, b) => a + b, 0) / 4;
  const score        = Math.min(Math.round(avgDeviation * 100), 100);
  const { level, message } = resolveLevel(score, 'fitness');

  return {
    score,
    level,
    message,
    breakdown: {
      calorieTarget: { value: nutrition.calories, target: Math.round(mealTargets.calories) },
      proteinTarget: { value: nutrition.protein,  target: Math.round(mealTargets.protein) },
      carbTarget:    { value: nutrition.carbs,    target: Math.round(mealTargets.carbs) },
      fatTarget:     { value: nutrition.fat,      target: Math.round(mealTargets.fat) },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Food flags — individual nutrient warnings per food item for AR highlighting
// ─────────────────────────────────────────────────────────────────────────────

function buildFoodFlags(nutrition, cardioResult, diabetesResult) {
  const flags = [];
  const t = THRESHOLDS;

  if (nutrition.saturatedFat >= t.cardiovascular.saturatedFat_high) {
    flags.push({ type: 'saturatedFat', severity: 'danger',
                 message: 'Very high saturated fat — cardiac risk' });
  } else if (nutrition.saturatedFat >= t.cardiovascular.saturatedFat_caution) {
    flags.push({ type: 'saturatedFat', severity: 'caution',
                 message: 'Moderate saturated fat — watch intake' });
  }

  if (nutrition.sodium >= t.cardiovascular.sodium_high) {
    flags.push({ type: 'sodium', severity: 'danger',
                 message: 'High sodium — raises blood pressure' });
  }

  if (nutrition.sugar >= t.diabetes.sugar_high) {
    flags.push({ type: 'sugar', severity: 'danger',
                 message: 'High sugar — glycaemic spike risk' });
  } else if (nutrition.sugar >= t.diabetes.sugar_caution) {
    flags.push({ type: 'sugar', severity: 'caution',
                 message: 'Moderate sugar — consider smaller portion' });
  }

  const refinedCarbs = Math.max(0, (nutrition.carbs ?? 0) - (nutrition.fibre ?? 0));
  if (refinedCarbs >= t.diabetes.refinedCarbs_high) {
    flags.push({ type: 'refinedCarbs', severity: 'caution',
                 message: 'High refined carbs — low glycaemic option preferred' });
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * clampedScore – maps a value between caution and high thresholds to 30–100.
 * Below caution = 0–30, above high = 100.
 */
function clampedScore(value, cautionThreshold, highThreshold) {
  if (value <= 0)                return 0;
  if (value <= cautionThreshold) return (value / cautionThreshold) * 30;
  if (value >= highThreshold)    return 100;
  const range = highThreshold - cautionThreshold;
  return 30 + ((value - cautionThreshold) / range) * 70;
}

/**
 * reverseClampedScore – for beneficial metrics (more = lower risk).
 */
function reverseClampedScore(value, goodThreshold, badThreshold) {
  if (value >= goodThreshold) return 0;
  if (value <= badThreshold)  return 100;
  return ((goodThreshold - value) / (goodThreshold - badThreshold)) * 100;
}

function weightedComposite(profileScores) {
  // Worst profile drives the overall score (max, not average)
  const maxScore = Math.max(...profileScores.map(p => p.score));
  const avgScore = profileScores.reduce((s, p) => s + p.score, 0) / profileScores.length;
  // Blend 70% max + 30% average
  return Math.round(maxScore * 0.7 + avgScore * 0.3);
}

function resolveLevel(score, profile = null) {
  if (score >= 65) {
    const msgs = {
      cardiovascular: 'High cardiac risk — reduce sat. fat and sodium',
      diabetes:       'High glycaemic risk — choose lower sugar option',
      fitness:        'Far from macro targets — adjust portion',
      general:        'High risk item — consider an alternative',
    };
    return { level: 'danger', message: msgs[profile] ?? msgs.general };
  }
  if (score >= 35) {
    const msgs = {
      cardiovascular: 'Moderate cardiac risk — watch sat. fat',
      diabetes:       'Moderate glycaemic risk — pair with activity',
      fitness:        'Slightly off macro targets',
      general:        'Moderate risk — eat in moderation',
    };
    return { level: 'caution', message: msgs[profile] ?? msgs.general };
  }
  return { level: 'safe', message: 'Good nutritional choice' };
}

function getAlternatives(flags) {
  if (!flags.length) return [];
  const types = [...new Set(flags.map(f => f.type))];
  return types.flatMap(t => FOOD_ALTERNATIVES[t] ?? []).slice(0, 3);
}

function safeResult(message) {
  return {
    score: 0, level: 'safe', message,
    profiles: { cardiovascular: { score: 0, level: 'safe', message: '' },
                diabetes:       { score: 0, level: 'safe', message: '' },
                fitness:        { score: 0, level: 'safe', message: '' } },
    flags: [], alternatives: [], hasWearableData: false,
  };
}
