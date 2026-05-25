// Goal 2 — mHealth / wearable integration layer.
//
// On a real device with Google Fit installed we read live metrics; if anything
// fails (permission denied, no Fit, simulator, etc.) we fall back to a fixed
// demo profile so the risk engine still has data to work with.
//
// We deliberately keep this file dependency-light: react-native-google-fit is
// only imported inside the function so that an environment without the native
// module compiled in still loads the rest of the app.

import { Platform } from 'react-native';

const DEMO_PROFILE = {
  source: 'demo',
  restingHeartRate: 78,   // bpm
  stepsToday:       2400, // intentionally low — triggers low-activity diabetes flag
  sleepHours:       6.0,  // hours last night
  caloriesBurned:   320,
};

let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getHealthMetrics() {
  // serve cached values for 1 minute to avoid repeated fit queries per scan
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  if (Platform.OS === 'android') {
    try {
      const GoogleFit = require('react-native-google-fit').default;
      const { Scopes } = require('react-native-google-fit');

      const options = {
        scopes: [
          Scopes.FITNESS_ACTIVITY_READ,
          Scopes.FITNESS_HEART_RATE_READ,
          Scopes.FITNESS_SLEEP_READ,
        ],
      };
      const auth = await GoogleFit.authorize(options);
      if (!auth.success) throw new Error('Google Fit auth refused');

      const today = new Date();
      const start = new Date(today); start.setHours(0, 0, 0, 0);
      const opts = { startDate: start.toISOString(), endDate: today.toISOString() };

      const stepsRes = await GoogleFit.getDailyStepCountSamples(opts);
      const stepsToday = (stepsRes?.find(s => s.source === 'com.google.android.gms:estimated_steps')
                          ?.steps?.[0]?.value) ?? 0;

      let restingHeartRate = null;
      try {
        const hr = await GoogleFit.getHeartRateSamples(opts);
        if (hr?.length) restingHeartRate = Math.round(hr[hr.length - 1].value);
      } catch (_) {}

      let sleepHours = null;
      try {
        const sleep = await GoogleFit.getSleepSamples(opts, false);
        if (sleep?.length) {
          const ms = sleep.reduce((acc, s) => acc + (new Date(s.endDate) - new Date(s.startDate)), 0);
          sleepHours = Math.round(ms / 36e5 * 10) / 10;
        }
      } catch (_) {}

      cached = {
        source: 'google_fit',
        restingHeartRate,
        stepsToday,
        sleepHours,
        caloriesBurned: null,
      };
    } catch (e) {
      // Google Fit OAuth requires a Google Cloud OAuth client registered for
      // this app's signing-key SHA-1 + Fitness API enabled. Not configured for
      // this research build — demo profile is the intended fallback.
      console.log('[HealthMetrics] Using demo profile (Google Fit not configured):', e?.message);
      cached = DEMO_PROFILE;
    }
  } else {
    // iOS HealthKit bridge would go here. For now serve demo profile.
    cached = { ...DEMO_PROFILE, source: 'demo_ios' };
  }

  cachedAt = Date.now();
  return cached;
}
