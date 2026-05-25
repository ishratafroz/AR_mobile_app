// Diet risk engine. Combines FSA traffic-light nutrient thresholds with
// diabetes-specific signals (high GI + high sugar). Goal 2 will add wearable
// data (HR, steps) via the optional `healthMetrics` param.
//
// Thresholds are loosely based on UK FSA front-of-pack labelling for solid foods.

const HIGH = { fat: 17.5, saturatedFat: 5, sugar: 22.5, sodium: 600 };
const MED  = { fat: 3,    saturatedFat: 1.5, sugar: 5,  sodium: 120 };

export function computeRisk(nutrition, healthMetrics = null) {
  if (!nutrition) return { riskLevel: 'safe', riskMessage: 'No data', reasons: [], score: 0, diabetesFlag: false };

  const reasons = [];
  let score = 0;

  // --- nutrient-based risk (general cardiovascular) ---
  if (nutrition.saturatedFat >= HIGH.saturatedFat) { score += 2; reasons.push('high sat fat'); }
  else if (nutrition.saturatedFat >= MED.saturatedFat) { score += 1; }

  if (nutrition.sugar >= HIGH.sugar) { score += 2; reasons.push('high sugar'); }
  else if (nutrition.sugar >= MED.sugar) { score += 1; }

  if (nutrition.sodium >= HIGH.sodium) { score += 2; reasons.push('high sodium'); }
  else if (nutrition.sodium >= MED.sodium) { score += 1; }

  if (nutrition.fat >= HIGH.fat) { score += 1; reasons.push('high fat'); }

  // --- diabetes-specific signal (GI + sugar + activity) ---
  let diabetesFlag = false;
  const giHigh = nutrition.gi != null && nutrition.gi >= 70;
  const giMed  = nutrition.gi != null && nutrition.gi >= 56 && nutrition.gi < 70;

  if (giHigh) {
    score += 2;
    reasons.push(`high GI (${nutrition.gi})`);
    diabetesFlag = true;
  } else if (giMed) {
    score += 1;
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
