// ─────────────────────────────────────────────────────────────────────────────
// GoogleFitService.js  –  Goal 2 (Android)
// Bridges Google Fit / Android Health Connect via react-native-google-fit.
// Collects: heart rate, step count, calories burned, sleep sessions.
// Returns the same WearableMetrics shape as HealthKitService so RiskEngine
// works identically on both platforms.
// ─────────────────────────────────────────────────────────────────────────────

import GoogleFit, { Scopes } from 'react-native-google-fit';

// ─── OAuth scopes ─────────────────────────────────────────────────────────────
const OPTIONS = {
  scopes: [
    Scopes.FITNESS_ACTIVITY_READ,
    Scopes.FITNESS_HEART_RATE_READ,
    Scopes.FITNESS_SLEEP_READ,
    Scopes.FITNESS_BODY_READ,
  ],
};

let _authorised = false;

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * initGoogleFit
 * Call once at app start.  Triggers the Google account authorisation dialog.
 * @returns {Promise<boolean>}
 */
export async function initGoogleFit() {
  try {
    const authResult = await GoogleFit.authorize(OPTIONS);
    _authorised = authResult.success;
    if (!_authorised) {
      console.warn('[GoogleFit] Authorisation denied');
    }
    return _authorised;
  } catch (e) {
    console.error('[GoogleFit] Init error:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary metrics fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getWearableMetrics
 * Returns WearableMetrics — same shape as HealthKitService output.
 */
export async function getWearableMetrics() {
  if (!_authorised) {
    console.warn('[GoogleFit] Not authorised — returning empty metrics');
    return emptyMetrics();
  }

  const [heartRate, steps, calories, sleep] = await Promise.all([
    getLatestHeartRate(),
    getStepsToday(),
    getCaloriesToday(),
    getLastNightSleep(),
  ]);

  return {
    heartRate,
    restingHeartRate: heartRate,   // Google Fit does not separate resting HR in basic API
    hrv:             null,         // Not available in standard Google Fit API
    steps,
    caloriesBurned:  calories,
    sleepHours:      sleep?.hours   ?? null,
    sleepQuality:    sleep?.quality ?? null,
    timestamp:       Date.now(),
  };
}

/**
 * subscribeToHeartRate
 * Polls heart rate every 5 seconds (Google Fit has no push observer in RN).
 *
 * @param {(bpm: number) => void} callback
 * @returns {() => void}  stop polling
 */
export function subscribeToHeartRate(callback) {
  if (!_authorised) return () => {};

  const timer = setInterval(async () => {
    const bpm = await getLatestHeartRate();
    if (bpm !== null) callback(bpm);
  }, 5000);

  return () => clearInterval(timer);
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual metric helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getLatestHeartRate() {
  try {
    const options = {
      startDate: daysAgo(1).toISOString(),
      endDate:   new Date().toISOString(),
      bucketUnit: 'MINUTE',
      bucketInterval: 1,
    };
    const results = await GoogleFit.getHeartRateSamples(options);
    if (!results?.length) return null;
    // Take the most recent valid sample
    const latest = results.filter(r => r.value > 0).slice(-1)[0];
    return latest ? Math.round(latest.value) : null;
  } catch (e) {
    console.error('[GoogleFit] Heart rate error:', e);
    return null;
  }
}

async function getStepsToday() {
  try {
    const options = {
      startDate: startOfToday().toISOString(),
      endDate:   new Date().toISOString(),
    };
    const results = await GoogleFit.getDailyStepCountSamples(options);
    if (!results?.length) return 0;

    // Prefer "com.google.android.gms:estimated_steps" source
    const estimated = results.find(r =>
      r.source?.includes('estimated') || r.source?.includes('com.google.android.gms')
    );
    const sample = estimated ?? results[0];
    const todaySteps = sample?.steps?.find(s => {
      const d = new Date(s.date ?? s.startDate);
      return d.toDateString() === new Date().toDateString();
    });
    return todaySteps ? Math.round(todaySteps.value) : 0;
  } catch (e) {
    console.error('[GoogleFit] Steps error:', e);
    return 0;
  }
}

async function getCaloriesToday() {
  try {
    const options = {
      startDate: startOfToday().toISOString(),
      endDate:   new Date().toISOString(),
    };
    const results = await GoogleFit.getDailyCalorieSamples(options);
    if (!results?.length) return 0;
    const total = results.reduce((s, r) => s + (r.calorie ?? 0), 0);
    return Math.round(total);
  } catch (e) {
    console.error('[GoogleFit] Calories error:', e);
    return 0;
  }
}

async function getLastNightSleep() {
  try {
    const options = {
      startDate: daysAgo(2).toISOString(),
      endDate:   new Date().toISOString(),
    };
    const sessions = await GoogleFit.getSleepSamples(options);
    if (!sessions?.length) return null;

    // Take the most recent session
    const latest = sessions[sessions.length - 1];
    const startMs = new Date(latest.startDate).getTime();
    const endMs   = new Date(latest.endDate).getTime();
    const hours   = (endMs - startMs) / (1000 * 60 * 60);
    const quality = hours >= 7.5 ? 'good' : hours >= 5.5 ? 'fair' : 'poor';

    return { hours: Math.round(hours * 10) / 10, quality };
  } catch (e) {
    console.error('[GoogleFit] Sleep error:', e);
    return null;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptyMetrics() {
  return {
    heartRate: null, restingHeartRate: null, hrv: null,
    steps: 0, caloriesBurned: 0, sleepHours: null,
    sleepQuality: null, timestamp: Date.now(),
  };
}
