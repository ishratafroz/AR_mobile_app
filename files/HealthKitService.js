// ─────────────────────────────────────────────────────────────────────────────
// HealthKitService.js  –  Goal 2 (iOS)
// Bridges Apple HealthKit via react-native-health.
// Collects: heart rate, resting heart rate, HRV, step count,
//           active calories burned, sleep analysis.
// ─────────────────────────────────────────────────────────────────────────────

import AppleHealthKit from 'react-native-health';

// ─── Permissions requested at startup ────────────────────────────────────────
const PERMISSIONS = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.BodyMassIndex,
      AppleHealthKit.Constants.Permissions.Weight,
    ],
    write: [],
  },
};

let _initialised = false;

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * initHealthKit
 * Call once at app start (e.g. in App.js useEffect).
 * @returns {Promise<boolean>}  true if authorised
 */
export function initHealthKit() {
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
      if (err) {
        console.error('[HealthKit] Init failed:', err);
        resolve(false);
        return;
      }
      _initialised = true;
      resolve(true);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Data fetchers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getWearableMetrics
 * Fetches all relevant wearable metrics and returns a combined WearableMetrics object.
 *
 * WearableMetrics shape:
 * {
 *   heartRate:         number | null,   // most recent HR (bpm)
 *   restingHeartRate:  number | null,   // resting HR (bpm)
 *   hrv:               number | null,   // HRV SDNN (ms)
 *   steps:             number,          // steps today
 *   caloriesBurned:    number,          // active calories today (kcal)
 *   sleepHours:        number | null,   // last night sleep duration (hours)
 *   sleepQuality:      string | null,   // 'poor' | 'fair' | 'good'
 *   timestamp:         number,          // unix ms of fetch
 * }
 */
export async function getWearableMetrics() {
  if (!_initialised) {
    console.warn('[HealthKit] Not initialised — returning empty metrics');
    return emptyMetrics();
  }

  const [heartRate, restingHR, hrv, steps, calories, sleep] = await Promise.all([
    getLatestHeartRate(),
    getRestingHeartRate(),
    getLatestHRV(),
    getStepsToday(),
    getCaloriesToday(),
    getLastNightSleep(),
  ]);

  return {
    heartRate,
    restingHeartRate: restingHR,
    hrv,
    steps,
    caloriesBurned: calories,
    sleepHours:     sleep?.hours    ?? null,
    sleepQuality:   sleep?.quality  ?? null,
    timestamp:      Date.now(),
  };
}

/**
 * subscribeToHeartRate
 * Starts a live heart rate observer.  Calls callback with each new sample.
 * Returns an unsubscribe function.
 *
 * @param {(bpm: number) => void} callback
 * @returns {() => void}  call to stop observing
 */
export function subscribeToHeartRate(callback) {
  if (!_initialised) return () => {};

  const options = {
    type: AppleHealthKit.Constants.Observers.HeartRate,
  };

  AppleHealthKit.initHealthKit(PERMISSIONS, () => {
    AppleHealthKit.observeHeartRate(options, (err, result) => {
      if (err || !result) return;
      const bpm = result.value;
      if (typeof bpm === 'number' && bpm > 0) {
        callback(Math.round(bpm));
      }
    });
  });

  // react-native-health does not expose an explicit unsubscribe;
  // the observer is released when the component unmounts.
  return () => {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual metric helpers (private)
// ─────────────────────────────────────────────────────────────────────────────

function getLatestHeartRate() {
  return new Promise((resolve) => {
    const options = {
      unit: 'bpm',
      startDate: daysAgo(1).toISOString(),
      endDate:   new Date().toISOString(),
      ascending: false,
      limit: 1,
    };
    AppleHealthKit.getHeartRateSamples(options, (err, results) => {
      if (err || !results?.length) { resolve(null); return; }
      resolve(Math.round(results[0].value));
    });
  });
}

function getRestingHeartRate() {
  return new Promise((resolve) => {
    const options = {
      startDate: daysAgo(3).toISOString(),
      endDate:   new Date().toISOString(),
      limit: 1,
    };
    AppleHealthKit.getRestingHeartRate(options, (err, result) => {
      if (err || !result?.value) { resolve(null); return; }
      resolve(Math.round(result.value));
    });
  });
}

function getLatestHRV() {
  return new Promise((resolve) => {
    const options = {
      startDate: daysAgo(2).toISOString(),
      endDate:   new Date().toISOString(),
      limit: 1,
    };
    AppleHealthKit.getHeartRateVariabilitySamples(options, (err, results) => {
      if (err || !results?.length) { resolve(null); return; }
      resolve(Math.round(results[0].value));
    });
  });
}

function getStepsToday() {
  return new Promise((resolve) => {
    const options = {
      date: new Date().toISOString(),
      includeManuallyAdded: true,
    };
    AppleHealthKit.getStepCount(options, (err, result) => {
      if (err || !result?.value) { resolve(0); return; }
      resolve(Math.round(result.value));
    });
  });
}

function getCaloriesToday() {
  return new Promise((resolve) => {
    const options = {
      startDate: startOfToday().toISOString(),
      endDate:   new Date().toISOString(),
    };
    AppleHealthKit.getActiveEnergyBurned(options, (err, results) => {
      if (err || !results?.length) { resolve(0); return; }
      const total = results.reduce((s, r) => s + (r.value ?? 0), 0);
      resolve(Math.round(total));
    });
  });
}

function getLastNightSleep() {
  return new Promise((resolve) => {
    const options = {
      startDate: daysAgo(1).toISOString(),
      endDate:   new Date().toISOString(),
    };
    AppleHealthKit.getSleepSamples(options, (err, results) => {
      if (err || !results?.length) { resolve(null); return; }

      // Sum Asleep stages
      const asleepStages = results.filter(r =>
        r.value === 'ASLEEP' || r.value === 'ASLEEP_DEEP' ||
        r.value === 'ASLEEP_REM' || r.value === 'ASLEEP_CORE'
      );
      const totalMs = asleepStages.reduce((s, r) => {
        const start = new Date(r.startDate).getTime();
        const end   = new Date(r.endDate).getTime();
        return s + (end - start);
      }, 0);

      const hours   = totalMs / (1000 * 60 * 60);
      const quality = hours >= 7.5 ? 'good'
        : hours >= 5.5 ? 'fair'
        : 'poor';

      resolve({ hours: Math.round(hours * 10) / 10, quality });
    });
  });
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
