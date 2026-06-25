// Android Health Connect integration (Goal 2 — mHealth / wearable layer).
//
// Health Connect is the on-device datastore that REPLACES the deprecated Google Fit
// APIs. It aggregates data written by the user's wearable / health apps (Fitbit,
// Samsung Health, Wear OS, the Motorola Moto Watch / Moto Body, Google Fit, etc.)
// into one local API. Data stays ON THE DEVICE — consistent with the app's
// privacy-first design (Goal 3 human-subjects research).
//
// We read: heart rate, steps, active calories, sleep, and (to auto-fill the health
// profile) the latest blood glucose + blood pressure. Everything is wrapped in
// try/catch and returns null on any failure so the caller can fall back to Google
// Fit or the demo profile — the risk engine never starves.
//
// Native module: react-native-health-connect. Imported lazily so an environment
// without it compiled in still loads the rest of the app.

import { Platform } from 'react-native';

// Records we ask to READ. Matches the <uses-permission android:name=
// "android.permission.health.READ_*"> entries in AndroidManifest.xml.
export const READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'BloodGlucose' },
  { accessType: 'read', recordType: 'BloodPressure' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Height' },
];

const SDK_AVAILABLE = 3; // SdkAvailabilityStatus.SDK_AVAILABLE

function lib() {
  // eslint-disable-next-line global-require
  return require('react-native-health-connect');
}

function startOfTodayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
const nowISO = () => new Date().toISOString();
const hoursAgoISO = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const between = (startTime, endTime) => ({ timeRangeFilter: { operator: 'between', startTime, endTime } });

// readRecords returns an array in v1.x but { records } in v3.x — normalize.
const recsOf = (res) => (Array.isArray(res) ? res : (res?.records || []));
// Most-recent record by a timestamp field ('time' or 'startTime').
function latestOf(records, field = 'time') {
  let best = null, bestT = -Infinity;
  for (const r of records) {
    const t = new Date(r[field] || r.startTime || r.time || 0).getTime();
    if (t >= bestT) { bestT = t; best = r; }
  }
  return best;
}

// Is Health Connect installed & available on this device?
export async function isHealthConnectAvailable() {
  if (Platform.OS !== 'android') return false;
  try {
    const HC = lib();
    await HC.initialize();
    const status = await HC.getSdkStatus();
    return status === SDK_AVAILABLE;
  } catch (_) {
    return false;
  }
}

// True if the user has already granted at least the core read permissions.
export async function hasHealthConnectPermissions() {
  try {
    const HC = lib();
    await HC.initialize();
    const granted = await HC.getGrantedPermissions();
    return Array.isArray(granted) && granted.length > 0;
  } catch (_) {
    return false;
  }
}

// Interactive: prompts the Health Connect permission screen. Returns granted list.
export async function requestHealthConnectPermissions() {
  const HC = lib();
  await HC.initialize();
  return HC.requestPermission(READ_PERMISSIONS);
}

export async function openHealthConnect() {
  try { await lib().openHealthConnectSettings(); } catch (_) {}
}

// ---- readers (each tolerant of missing data) ----
async function latestHeartRate(HC) {
  try {
    const recs = recsOf(await HC.readRecords('HeartRate', between(hoursAgoISO(24), nowISO())));
    let latest = null, latestT = -Infinity;
    for (const r of recs) {
      for (const s of r.samples || []) {
        const t = new Date(s.time).getTime();
        if (t >= latestT) { latestT = t; latest = s.beatsPerMinute; }
      }
    }
    return latest != null ? Math.round(latest) : null;
  } catch (_) { return null; }
}

async function restingHeartRate(HC) {
  try {
    const last = latestOf(recsOf(await HC.readRecords('RestingHeartRate', between(hoursAgoISO(48), nowISO()))));
    return last?.beatsPerMinute != null ? Math.round(last.beatsPerMinute) : null;
  } catch (_) { return null; }
}

async function stepsToday(HC) {
  try {
    const recs = recsOf(await HC.readRecords('Steps', between(startOfTodayISO(), nowISO())));
    return recs.reduce((a, r) => a + (r.count || 0), 0) || null;
  } catch (_) { return null; }
}

async function caloriesToday(HC) {
  for (const type of ['ActiveCaloriesBurned', 'TotalCaloriesBurned']) {
    try {
      const recs = recsOf(await HC.readRecords(type, between(startOfTodayISO(), nowISO())));
      const kcal = recs.reduce((a, r) => a + (r.energy?.inKilocalories || 0), 0);
      if (kcal > 0) return Math.round(kcal);
    } catch (_) {}
  }
  return null;
}

async function sleepHours(HC) {
  try {
    const recs = recsOf(await HC.readRecords('SleepSession', between(hoursAgoISO(24), nowISO())));
    const ms = recs.reduce((a, r) => a + (new Date(r.endTime) - new Date(r.startTime)), 0);
    return ms > 0 ? Math.round(ms / 36e5 * 10) / 10 : null;
  } catch (_) { return null; }
}

async function latestGlucose(HC) {
  try {
    const last = latestOf(recsOf(await HC.readRecords('BloodGlucose', between(hoursAgoISO(24 * 30), nowISO()))));
    const mgdl = last?.level?.inMilligramsPerDeciliter;
    return mgdl != null ? Math.round(mgdl) : null;
  } catch (_) { return null; }
}

async function latestBloodPressure(HC) {
  try {
    const last = latestOf(recsOf(await HC.readRecords('BloodPressure', between(hoursAgoISO(24 * 30), nowISO()))));
    if (!last) return null;
    return {
      systolic: last.systolic?.inMillimetersOfMercury != null ? Math.round(last.systolic.inMillimetersOfMercury) : null,
      diastolic: last.diastolic?.inMillimetersOfMercury != null ? Math.round(last.diastolic.inMillimetersOfMercury) : null,
    };
  } catch (_) { return null; }
}

async function latestWeight(HC) {
  try {
    const last = latestOf(recsOf(await HC.readRecords('Weight', between(hoursAgoISO(24 * 90), nowISO()))));
    const kg = last?.weight?.inKilograms;
    return kg != null ? Math.round(kg * 10) / 10 : null;
  } catch (_) { return null; }
}

async function latestHeight(HC) {
  try {
    const last = latestOf(recsOf(await HC.readRecords('Height', between(hoursAgoISO(24 * 365), nowISO()))));
    const m = last?.height?.inMeters;
    return m != null ? Math.round(m * 100) : null; // → cm
  } catch (_) { return null; }
}

// Main entry. interactive:true will prompt for permission if not yet granted.
// Returns the metrics object (same shape as HealthMetrics demo profile) or null.
export async function getHealthConnectMetrics({ interactive = false } = {}) {
  if (Platform.OS !== 'android') return null;
  let HC;
  try {
    HC = lib();
    await HC.initialize();
    if ((await HC.getSdkStatus()) !== SDK_AVAILABLE) return null;
  } catch (_) {
    return null; // module not present / HC unavailable
  }

  // Respect the no-prompt-before-explicit-connect rule: only request permission
  // on an interactive call. Non-interactive reads only if already granted.
  try {
    const granted = await HC.getGrantedPermissions();
    const grantedCount = Array.isArray(granted) ? granted.length : 0;
    if (interactive) {
      // Always request the FULL set so newly-added record types (height/weight)
      // get prompted even when some permissions were granted earlier. HC only
      // shows the not-yet-granted ones.
      const after = await HC.requestPermission(READ_PERMISSIONS);
      if (!after || after.length === 0) return null;
    } else if (grantedCount === 0) {
      return null;
    }
  } catch (_) {
    if (!interactive) return null;
  }

  const [hr, resting, steps, kcal, sleep, glucose, bp, weight, height] = await Promise.all([
    latestHeartRate(HC), restingHeartRate(HC), stepsToday(HC),
    caloriesToday(HC), sleepHours(HC), latestGlucose(HC), latestBloodPressure(HC),
    latestWeight(HC), latestHeight(HC),
  ]);

  const out = {
    source: 'health_connect',
    restingHeartRate: resting != null ? resting : hr, // prefer true resting HR
    stepsToday: steps,
    sleepHours: sleep,
    caloriesBurned: kcal,
  };
  if (glucose != null) out.glucose = glucose;
  if (bp) { out.bpSystolic = bp.systolic; out.bpDiastolic = bp.diastolic; }
  if (weight != null) out.weightKg = weight;
  if (height != null) out.heightCm = height;

  // If literally nothing came back, signal "no data" so caller can fall back.
  const hasAny = ['restingHeartRate', 'stepsToday', 'sleepHours', 'caloriesBurned',
    'glucose', 'bpSystolic', 'weightKg', 'heightCm'].some(k => out[k] != null);
  return hasAny ? out : null;
}
