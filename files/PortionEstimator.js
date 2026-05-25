// ─────────────────────────────────────────────────────────────────────────────
// PortionEstimator.js  –  Goal 1
// Estimates the weight (grams) of a food item from:
//   • The AR bounding box area relative to a reference object
//   • Food density lookup tables
//   • Optional AR depth API reading
//
// The reference object is a standard dinner plate (26 cm diameter).
// When no reference is detected the user can override via small/medium/large.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Food density table  (g per cm³, approximate)
// Used to convert estimated volume → weight
// ─────────────────────────────────────────────────────────────────────────────
const DENSITY_TABLE = {
  // Proteins
  'chicken':          1.05,
  'grilled chicken':  1.05,
  'fish':             1.05,
  'salmon':           1.05,
  'beef':             1.08,
  'steak':            1.08,
  'pork':             1.06,
  'egg':              1.03,
  'tofu':             1.04,
  'shrimp':           1.00,

  // Carbs / grains
  'rice':             0.85,
  'white rice':       0.85,
  'brown rice':       0.82,
  'pasta':            0.80,
  'bread':            0.30,
  'potato':           0.90,
  'sweet potato':     0.88,
  'oatmeal':          0.70,

  // Vegetables
  'salad':            0.25,
  'broccoli':         0.40,
  'carrot':           0.60,
  'spinach':          0.25,
  'tomato':           0.95,
  'cucumber':         0.95,
  'lettuce':          0.20,

  // Fruits
  'apple':            0.85,
  'banana':           0.95,
  'orange':           0.88,
  'grapes':           0.90,
  'strawberry':       0.75,

  // Dairy
  'cheese':           1.10,
  'yogurt':           1.05,
  'milk':             1.03,

  // High-fat / fast food
  'burger':           0.85,
  'hamburger':        0.85,
  'pizza':            0.75,
  'fries':            0.60,
  'french fries':     0.60,

  // Default fallback
  'default':          0.90,
};

// Standard plate diameter and area (26 cm plate used as visual reference)
const STANDARD_PLATE_DIAMETER_CM = 26;
const STANDARD_PLATE_AREA_CM2    = Math.PI * (STANDARD_PLATE_DIAMETER_CM / 2) ** 2;

// Typical portion height per food category (cm) – used to estimate volume
const HEIGHT_TABLE = {
  macro:   3.0,   // thick items: meat, potato
  grain:   2.0,   // rice, pasta (spread out)
  veggie:  2.5,   // mixed vegetables, salad bowl
  liquid:  0.5,   // sauces, dips
  default: 2.5,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * estimatePortionGrams
 * Primary estimation function.
 *
 * @param {object} params
 *   @param {string} foodLabel         – e.g. "grilled chicken"
 *   @param {object} boundingBox       – { x, y, w, h } in image pixel coords
 *   @param {object} imageSize         – { width, height } of captured frame
 *   @param {object|null} plateBBox    – bounding box of the reference plate (if detected)
 *   @param {number|null} depthMeters  – ARCore/ARKit depth reading at food centre (optional)
 *   @param {'small'|'medium'|'large'|null} userOverride – manual user selection
 *
 * @returns {{ grams: number, method: string, confidence: 'high'|'medium'|'low' }}
 */
export function estimatePortionGrams({
  foodLabel       = 'default',
  boundingBox,
  imageSize,
  plateBBox       = null,
  depthMeters     = null,
  userOverride    = null,
}) {
  // 1. User manually selected a size – use lookup table
  if (userOverride) {
    const grams = manualPortionLookup(foodLabel, userOverride);
    return { grams, method: 'manual_override', confidence: 'medium' };
  }

  // 2. Depth sensor available – best estimation
  if (depthMeters !== null && plateBBox !== null && boundingBox !== null) {
    const grams = estimateFromDepth(foodLabel, boundingBox, imageSize, plateBBox, depthMeters);
    return { grams, method: 'ar_depth', confidence: 'high' };
  }

  // 3. Plate reference visible – scale bounding box
  if (plateBBox !== null && boundingBox !== null) {
    const grams = estimateFromPlateReference(foodLabel, boundingBox, plateBBox);
    return { grams, method: 'plate_reference', confidence: 'medium' };
  }

  // 4. Bounding box only – rough estimate
  if (boundingBox !== null && imageSize !== null) {
    const grams = estimateFromBBoxOnly(foodLabel, boundingBox, imageSize);
    return { grams, method: 'bbox_only', confidence: 'low' };
  }

  // 5. No geometry available – use average portion
  const grams = averagePortionGrams(foodLabel);
  return { grams, method: 'average_portion', confidence: 'low' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimation strategies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * estimateFromDepth
 * Uses ARCore/ARKit depth reading to estimate physical height of the food,
 * combined with bounding box area to compute volume, then multiplies by density.
 */
function estimateFromDepth(foodLabel, bBox, imageSize, plateBBox, depthMeters) {
  // Step 1: Compute the real-world area of the plate at the measured depth
  const platePixelWidth     = plateBBox.w;
  const platePixelDiameter  = platePixelWidth;
  const metersPerPixel      = STANDARD_PLATE_DIAMETER_CM / 100 / platePixelDiameter;

  // Step 2: Convert food bounding box area to real-world area (cm²)
  const foodPixelArea = bBox.w * bBox.h;
  const foodRealArea_m2 = foodPixelArea * (metersPerPixel ** 2);
  const foodRealArea_cm2 = foodRealArea_m2 * 10000;

  // Step 3: Estimate height from depth sensor (depth is distance to surface centre)
  // We model food height as difference between plate surface depth and food-top depth
  // For a flat plate, the plate surface is approximately depthMeters + foodHeight
  const estimatedHeight_cm = Math.min(depthMeters * 30, 8); // cap at 8cm

  // Step 4: Volume (cm³) ≈ area × height × shape factor (0.65 for non-rectangular)
  const volume_cm3 = foodRealArea_cm2 * estimatedHeight_cm * 0.65;

  // Step 5: Weight = volume × density
  const density = getDensity(foodLabel);
  return clampGrams(volume_cm3 * density);
}

/**
 * estimateFromPlateReference
 * Computes what fraction of the plate the food item occupies,
 * applies average portion depth, then multiplies by density.
 */
function estimateFromPlateReference(foodLabel, bBox, plateBBox) {
  const foodArea  = bBox.w * bBox.h;
  const plateArea = plateBBox.w * plateBBox.h;
  const fraction  = Math.min(foodArea / plateArea, 1.0);

  // Standard plate holds ~600g of food when full
  const FULL_PLATE_GRAMS = 600;
  const rawGrams = fraction * FULL_PLATE_GRAMS;

  // Apply density correction
  const densityFactor = getDensity(foodLabel) / 0.85;  // normalised to rice density
  return clampGrams(rawGrams * densityFactor);
}

/**
 * estimateFromBBoxOnly
 * Assumes the food occupies a typical fraction of the camera frame.
 */
function estimateFromBBoxOnly(foodLabel, bBox, imageSize) {
  const frameFraction = (bBox.w * bBox.h) / (imageSize.width * imageSize.height);

  // Calibration: a typical meal fills ~25% of a phone frame at arm's length
  const CALIBRATION_GRAMS = 200;  // grams when filling 25% of frame
  const CALIBRATION_FRAC  = 0.25;

  const rawGrams = (frameFraction / CALIBRATION_FRAC) * CALIBRATION_GRAMS;
  return clampGrams(rawGrams);
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual override lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MANUAL_PORTIONS
 * Typical small / medium / large portion weights by food category.
 */
const MANUAL_PORTIONS = {
  chicken:       { small: 85,  medium: 150, large: 220 },
  fish:          { small: 85,  medium: 150, large: 200 },
  beef:          { small: 100, medium: 170, large: 250 },
  rice:          { small: 80,  medium: 150, large: 240 },
  pasta:         { small: 100, medium: 180, large: 280 },
  bread:         { small: 30,  medium: 60,  large: 90  },
  salad:         { small: 50,  medium: 100, large: 200 },
  vegetables:    { small: 60,  medium: 100, large: 180 },
  fruit:         { small: 80,  medium: 130, large: 200 },
  pizza:         { small: 100, medium: 175, large: 280 },
  burger:        { small: 120, medium: 200, large: 300 },
  fries:         { small: 70,  medium: 115, large: 170 },
  default:       { small: 80,  medium: 150, large: 250 },
};

function manualPortionLookup(foodLabel, size) {
  const key = Object.keys(MANUAL_PORTIONS).find(k =>
    foodLabel.toLowerCase().includes(k)
  ) ?? 'default';
  return MANUAL_PORTIONS[key][size];
}

function averagePortionGrams(foodLabel) {
  return manualPortionLookup(foodLabel, 'medium');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDensity(foodLabel) {
  const key = Object.keys(DENSITY_TABLE).find(k =>
    foodLabel.toLowerCase().includes(k)
  );
  return key ? DENSITY_TABLE[key] : DENSITY_TABLE['default'];
}

function clampGrams(grams) {
  // Realistic food portion range: 20g – 600g
  return Math.round(Math.min(Math.max(grams, 20), 600));
}

/**
 * getPortionSizeLabel
 * Returns a human-readable size label for the given gram weight.
 */
export function getPortionSizeLabel(grams) {
  if (grams < 80)  return 'small';
  if (grams < 180) return 'medium';
  return 'large';
}
