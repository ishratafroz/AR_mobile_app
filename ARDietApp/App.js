import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { LogBox } from 'react-native';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Health metrics fall back to a demo profile when Google Fit is unreachable (offline /
// not configured on this research build). That surfaces a harmless "Network request
// failed" — suppress it so it doesn't look like a real error. SCAN is fully on-device.
LogBox.ignoreLogs(['Network request failed']);

import ARFoodScanScene from './src/scenes/ARFoodScanScene';
import { classifyFoodLocal } from './src/services/LocalFoodClassifier';
import { detectFoodBoxes } from './src/services/FoodBoxDetector';
import { classifyProduceLocal } from './src/services/LocalProduceClassifier';
import { getNutrition, getNutritionOffline, OFFLINE_FOODS, applyPortion } from './src/services/NutritionAPI';
import { assessForUser } from './src/engine/RiskEngine';
import { getHealthMetrics } from './src/services/HealthMetrics';
import { COMMON_FOODS } from './src/data/GlycemicIndex';

import { C, RISK, VERDICT, PROFILES } from './src/ui/theme';
import { Ring } from './src/ui/Ring';
import { NutritionCard } from './src/ui/NutritionCard';
import { Dashboard } from './src/ui/Dashboard';
import { HealthPanel } from './src/ui/HealthPanel';
import { HealthIntake, EMPTY_USER } from './src/ui/HealthIntake';
import { ConfirmFood } from './src/ui/ConfirmFood';
import { Login } from './src/ui/Login';
import { ChatPanel } from './src/ui/ChatPanel';
import { answer, buildFacts, SUGGESTIONS } from './src/engine/Assistant';
import { isLlamaAvailable, chatLlama } from './src/services/LlamaChat';
import {
  getSession, getAccountUser, updateAccountUser, signOut, logKeyFor, historyKeyFor, regionKeyFor,
} from './src/services/Accounts';
import { isRegionFood } from './src/data/Cuisines';

// Foods the confirm/correct search can offer (resolve to on-device nutrition or GI).
const SEARCH_FOODS = Array.from(new Set([...OFFLINE_FOODS, ...COMMON_FOODS])).sort();

// Merge box-detector + classifier guesses into one ranked candidate list.
//
// Key insight behind the ranking: the box DETECTOR is the only model that can
// recognize RAW produce (apple/orange/banana/grape) — the AIY dish CLASSIFIER's
// 2,024-word vocabulary is entirely *prepared dishes* (Apple pie, Banana split,
// Grape pie...) and can never output a bare fruit. So when you point at a real
// apple, the classifier returns a high-scoring dish and the box detector returns
// "Apple" at a lower raw score. Plain max-score would bury the correct fruit
// under the dish. We fix that by boosting box-sourced candidates: a localizable,
// countable raw item outranks a same-or-lower dish guess. Agreement boosts more.
// The user still gets the final say in the confirm step.
const RAW_PRIORITY = 0.3; // raw-food signals (produce classifier / box detector)
const BOTH_AGREE   = 0.2; // multiple models named it → extra confidence
const REGION_MATCH = 0.15; // candidate belongs to the user's selected cuisine

function mergeCandidates(boxes, cls, produce = [], regionKey = 'global') {
  const map = new Map();
  const add = (name, score, src) => {
    const key = name.toLowerCase();
    const ex = map.get(key);
    if (ex) { ex.score = Math.max(ex.score, score); ex.src.add(src); }
    else map.set(key, { name, score, src: new Set([src]) });
  };
  produce.forEach(p => add(p.name, p.score, 'produce')); // dedicated raw fruit/veg
  boxes.forEach(b => add(b.name, b.score, 'box'));        // localized raw food (4 fruits)
  cls.forEach(c => add(c.name, c.score, 'cls'));          // prepared-dish classifier
  return [...map.values()]
    .map(c => {
      let rank = c.score;
      // Raw-food signals outrank the dish classifier, whose vocabulary can't
      // produce a bare fruit/vegetable in the first place.
      if (c.src.has('produce') || c.src.has('box')) rank += RAW_PRIORITY;
      if (c.src.size > 1) rank += BOTH_AGREE;            // corroborated by >1 model
      // Nudge candidates that match the user's cuisine — helps disambiguate when
      // the global model is unsure between a regional dish and a Western one.
      if (isRegionFood(c.name, regionKey)) rank += REGION_MATCH;
      return {
        name: c.name,
        score: c.score,                                  // raw confidence shown to user
        rank: Math.min(0.99, rank),                      // internal ordering only
        hasNutrition: !!getNutritionOffline(c.name),
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6);
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// How many days of food history to retain (bounds AsyncStorage growth).
const HISTORY_DAYS = 60;

// Keep only the most recent HISTORY_DAYS dates in the history map.
function capHistory(map) {
  const dates = Object.keys(map).sort();          // ascending
  if (dates.length <= HISTORY_DAYS) return map;
  const keep = dates.slice(dates.length - HISTORY_DAYS);
  const out = {};
  keep.forEach(d => { out[d] = map[d]; });
  return out;
}

// Portion multipliers the user can pick in the nutrition card.
const PORTION_STEPS = [0.5, 1, 1.5, 2, 3];

// Rough initial portion guess from the detected box area (fraction of the frame).
// Only a seed — the user adjusts it. Skipped when item-count already scales the
// portion (count > 1), to avoid double-counting size × count.
function seedMultFromArea(areaFrac) {
  if (!areaFrac) return 1;
  if (areaFrac < 0.08) return 0.5;
  if (areaFrac < 0.20) return 1;
  if (areaFrac < 0.35) return 1.5;
  return 2;
}

function portionLabelOf(food) {
  const parts = [`${food.portionGrams} g`];
  if (food.countDetected > 1) parts.unshift(`${food.countDetected} items`);
  return parts.join(' · ');
}

// Scale per-100g macros to what was actually eaten (prefers explicit per-portion
// fields from applyPortion; falls back to scaling by grams).
function computeConsumed(food) {
  const g = food.portionGrams;
  const f = g != null ? g / 100 : 1;
  return {
    calories: food.caloriesPortion != null ? food.caloriesPortion : Math.round((food.calories || 0) * f),
    protein: Math.round(food.proteinPortion != null ? food.proteinPortion : (food.protein || 0) * f),
    carbs: Math.round(food.carbsPortion != null ? food.carbsPortion : (food.carbs || 0) * f),
    fat: Math.round(food.fatPortion != null ? food.fatPortion : (food.fat || 0) * f),
  };
}

export default function App() {
  const navRef = useRef(null);
  const arViewRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [lastFood, setLastFood] = useState(null);
  const [error, setError] = useState(null);
  const [scanToken, setScanToken] = useState(0);
  const [health, setHealth] = useState(null);

  const [user, setUser] = useState(EMPTY_USER);
  const [log, setLog] = useState([]);          // today's entries
  const [history, setHistory] = useState({});  // { 'YYYY-MM-DD': items[] } across days
  const [region, setRegion] = useState('global'); // selected cuisine (recognition bias)

  const [authUser, setAuthUser] = useState(null); // signed-in username, or null
  const [booting, setBooting] = useState(true);   // restoring session on launch

  const [pickerOpen, setPickerOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [dashOpen, setDashOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);    // right panel: rule-based engine
  const [llamaOpen, setLlamaOpen] = useState(false);  // left panel: local Llama 3
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(null); // { candidates, photoUri, boxCounts }
  const [filter, setFilter] = useState('');

  const profile = user?.focus || 'general';
  const goal = Number(user?.dailyGoal) || PROFILES[profile]?.goal || 2000;

  // ---- persistence (per signed-in account) ----
  async function loadUserData(username) {
    const u = await getAccountUser(username);
    setUser({ ...EMPTY_USER, ...(u || {}) });

    // Load the multi-day history map first.
    let hist = {};
    try {
      const rawH = await AsyncStorage.getItem(historyKeyFor(username));
      const parsedH = rawH ? JSON.parse(rawH) : null;
      if (parsedH && typeof parsedH === 'object') hist = parsedH;
    } catch (_) { hist = {}; }

    // Load today's working log. If the stored daily log is from a PAST day, roll
    // it into history (so yesterday isn't lost) before resetting today's view.
    try {
      const raw = await AsyncStorage.getItem(logKeyFor(username));
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.date === todayStr() && Array.isArray(parsed.items)) {
        setLog(parsed.items);
        hist[todayStr()] = parsed.items;
      } else {
        if (parsed?.date && Array.isArray(parsed.items) && parsed.items.length && !hist[parsed.date]) {
          hist[parsed.date] = parsed.items; // preserve the previous day
        }
        setLog([]);
      }
    } catch (_) { setLog([]); }

    hist = capHistory(hist);
    setHistory(hist);
    AsyncStorage.setItem(historyKeyFor(username), JSON.stringify(hist)).catch(() => {});

    try {
      const r = await AsyncStorage.getItem(regionKeyFor(username));
      setRegion(r || 'global');
    } catch (_) { setRegion('global'); }
  }

  // Wearable/health metrics — only fetched once a user is signed in, so the
  // Google Fit account prompt never appears before login.
  function refreshHealth() {
    getHealthMetrics().then((h) => {
      console.log('[HC] refreshHealth metrics:', JSON.stringify(h));
      setHealth(h);
    }).catch(() => {});
  }

  // Auto-sync profile vitals whenever Health Connect data arrives — from the
  // login-time read OR the explicit Connect tap. Without this, the Health bar
  // updated but the profile (manual-input fields) stayed on the old values.
  useEffect(() => {
    if (!health || health.source !== 'health_connect' || !authUser) return;
    setUser(prev => {
      const u = {};
      if (health.glucose != null && prev.glucose !== health.glucose) u.glucose = health.glucose;
      if (health.bpSystolic != null && prev.bpSystolic !== health.bpSystolic) u.bpSystolic = health.bpSystolic;
      if (health.bpDiastolic != null && prev.bpDiastolic !== health.bpDiastolic) u.bpDiastolic = health.bpDiastolic;
      if (health.restingHeartRate != null && prev.pulse !== health.restingHeartRate) u.pulse = health.restingHeartRate;
      if (health.weightKg != null && prev.weightKg !== health.weightKg) u.weightKg = health.weightKg;
      if (health.heightCm != null && prev.heightCm !== health.heightCm) u.heightCm = health.heightCm;
      if (!Object.keys(u).length) return prev;
      const next = { ...prev, ...u };
      updateAccountUser(authUser, next);
      return next;
    });
  }, [health, authUser]);

  // Explicit "Connect Health Connect" tap → prompts permission, fetches live data,
  // and UPDATES the profile clinical vitals (glucose / blood pressure / resting pulse)
  // with the latest readings from Health Connect (which aggregates Google Fit data).
  // This refreshes EXISTING values, not just blanks, so the profile reflects the wearable.
  async function connectHealth() {
    const h = await getHealthMetrics({ interactive: true }).catch((e) => { console.log('[HC] connect error', e?.message || e); return null; });
    console.log('[HC] metrics from Health Connect:', JSON.stringify(h));
    if (!h) { Alert.alert('Health Connect', 'Could not read from Health Connect. Make sure permissions were allowed.'); return; }
    setHealth(h); // the [health] effect above syncs these vitals into the profile

    // Re-assess the current food under the refreshed vitals.
    if (lastFood && !lastFood.noNutrition) {
      const next = { ...user, ...(h.glucose != null && { glucose: h.glucose }), ...(h.bpSystolic != null && { bpSystolic: h.bpSystolic, bpDiastolic: h.bpDiastolic }), ...(h.restingHeartRate != null && { pulse: h.restingHeartRate }) };
      const assess = assessForUser(lastFood, h, next, { caloriesToday: totals.calories, goal });
      setLastFood({ ...lastFood, ...assess });
    }

    // Transparent feedback: what synced into the profile, and what HC didn't have.
    const synced = [];
    if (h.heightCm != null) synced.push(`Height ${h.heightCm} cm`);
    if (h.weightKg != null) synced.push(`Weight ${h.weightKg} kg`);
    if (h.bpSystolic != null) synced.push(`BP ${h.bpSystolic}/${h.bpDiastolic ?? '—'}`);
    if (h.glucose != null) synced.push(`Glucose ${h.glucose} mg/dL`);
    if (h.restingHeartRate != null) synced.push(`Pulse ${h.restingHeartRate} bpm`);
    const missing = ['heightCm', 'weightKg', 'bpSystolic', 'glucose']
      .filter(k => h[k] == null)
      .map(k => ({ heightCm: 'height', weightKg: 'weight', bpSystolic: 'blood pressure', glucose: 'glucose' }[k]));
    Alert.alert(
      'Health Connect synced',
      (synced.length ? `Updated your profile:\n• ${synced.join('\n• ')}` : 'No profile vitals (height/weight/BP/glucose) were found in Health Connect — only activity data.') +
      (missing.length ? `\n\nNot in Health Connect: ${missing.join(', ')}. Enter them once in the Health Connect app (or Fit) and reconnect.` : '')
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const sess = await getSession();
        if (sess) { setAuthUser(sess); await loadUserData(sess); refreshHealth(); }
      } catch (_) {}
      setBooting(false);
    })();
  }, []);

  // Called by the Login screen on successful sign-in / sign-up.
  async function onAuthed(username, _user, isSignup) {
    setAuthUser(username);
    await loadUserData(username);
    refreshHealth();
    if (isSignup) setIntakeOpen(true); // prompt new users to fill their profile
  }

  async function onLogout() {
    await signOut();
    setAuthUser(null);
    setUser(EMPTY_USER);
    setLog([]);
    setHistory({});
    setRegion('global');
    setLastFood(null);
    setIntakeOpen(false);
  }

  function persistLog(items) {
    if (!authUser) return;
    AsyncStorage.setItem(logKeyFor(authUser), JSON.stringify({ date: todayStr(), items })).catch(() => {});
    // Mirror today's entries into the multi-day history (timeseries).
    setHistory(prev => {
      const next = capHistory({ ...prev, [todayStr()]: items });
      AsyncStorage.setItem(historyKeyFor(authUser), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }
  function saveUser(next) {
    setUser(next);
    if (authUser) updateAccountUser(authUser, next);
    if (lastFood && !lastFood.noNutrition) {
      // re-assess the currently shown food under the updated profile
      const assess = assessForUser(lastFood, health, next, { caloriesToday: totals.calories, goal });
      setLastFood({ ...lastFood, ...assess });
    }
  }

  const totals = log.reduce(
    (a, it) => ({
      calories: a.calories + it.consumed.calories,
      protein: a.protein + it.consumed.protein,
      carbs: a.carbs + it.consumed.carbs,
      fat: a.fat + it.consumed.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function loadFood(nutrition) {
    if (!nutrition) throw new Error('No nutrition data');
    const h = health || (await getHealthMetrics().catch(() => null));
    if (h && !health) setHealth(h);
    // History so far today → lets the verdict speak to the user's running total.
    const assess = assessForUser(nutrition, h, user, { caloriesToday: totals.calories, goal });
    const id = `${Date.now()}`;
    const food = { ...nutrition, ...assess, health: h, logId: id };
    setLastFood(food);
    setScanToken(t => t + 1);

    const entry = {
      id,
      name: food.name,
      consumed: computeConsumed(food),
      riskLevel: food.riskLevel,
      time: nowTime(),
      recognizedBy: food.recognizedBy || null,
    };
    setLog(prev => {
      const next = [entry, ...prev];
      persistLog(next);
      return next;
    });
  }

  // User adjusts the portion in the card → rescale macros/GL, re-assess against
  // the day, and update the matching log entry.
  function changePortion(mult) {
    if (!lastFood || lastFood.noNutrition) return;
    const base = lastFood.baseGrams != null ? lastFood.baseGrams : (lastFood.portionGrams || 100);
    const count = lastFood.countDetected || 1;
    const portion = applyPortion(lastFood, base * count * mult);
    const resized = { ...lastFood, sizeMult: mult, ...portion };
    resized.portionLabel = portionLabelOf(resized);

    // Budget excludes this item's current calories so the projection is correct.
    const others = log.filter(e => e.id !== lastFood.logId);
    const caloriesToday = others.reduce((a, e) => a + e.consumed.calories, 0);
    const assess = assessForUser(resized, health, user, { caloriesToday, goal });
    const next = { ...resized, ...assess };
    setLastFood(next);

    setLog(prev => {
      const nextLog = prev.map(e =>
        e.id === lastFood.logId
          ? { ...e, consumed: computeConsumed(next), riskLevel: next.riskLevel }
          : e
      );
      persistLog(nextLog);
      return nextLog;
    });
  }

  function clearLog() {
    setLog([]);
    persistLog([]);
  }

  function changeRegion(key) {
    setRegion(key);
    if (authUser) AsyncStorage.setItem(regionKeyFor(authUser), key).catch(() => {});
  }

  async function captureScene() {
    const result = await launchCamera({
      mediaType: 'photo', includeBase64: true, saveToPhotos: false,
      cameraType: 'back', quality: 0.7, maxWidth: 1280, maxHeight: 1280,
    });
    if (result?.didCancel) return { cancelled: true };
    if (result?.errorCode) throw new Error(`Camera: ${result.errorMessage || result.errorCode}`);
    const asset = result?.assets?.[0];
    const base64 = asset?.base64;
    if (!base64) return null;
    // uri = the photo file in app-private cache (stays on the phone)
    return { base64, uri: asset?.uri || null };
  }

  async function onScan() {
    if (scanning) return;
    setScanning(true);
    setError(null);
    try {
      let shot;
      try {
        shot = await captureScene();
      } catch (e) {
        setError(`Camera capture failed: ${e?.message || e}`);
        return;
      }
      if (shot?.cancelled) return;
      if (!shot?.base64) { setError('Camera capture failed — try PICK'); setPickerOpen(true); return; }

      // Three on-device models, image never leaves the phone:
      //  - box DETECTOR: where is the food + how many items (counting, portions)
      //  - dish CLASSIFIER: what prepared dish is it (2,024-food vocabulary)
      //  - produce CLASSIFIER: what raw fruit/vegetable is it (fills the dish
      //    classifier's blind spot — it has no bare-fruit classes). Disabled
      //    until a produce.tflite is wired (see produceModelSource.js); returns
      //    [] until then, so this is safe to always call.
      let boxes = [];
      try { boxes = await detectFoodBoxes(shot.base64); } catch (_) {}

      let produce = [];
      try { produce = await classifyProduceLocal(shot.base64); } catch (_) {}

      let cls = [];
      try {
        cls = await classifyFoodLocal(shot.base64);
      } catch (e) {
        if (!boxes.length && !produce.length) throw new Error(String(e?.message || e));
      }

      // Merge all models into one ranked list — none auto-wins, but raw-food
      // signals are prioritized. The user confirms (or corrects) the guess in
      // the next step, the reliable fix for on-device misclassification.
      const candidates = mergeCandidates(boxes, cls, produce, region);
      // Per-food item count + how much of the frame it fills (for portion seeding).
      const boxCounts = {}, boxAreas = {};
      boxes.forEach(b => {
        const k = b.name.toLowerCase();
        boxCounts[k] = (boxCounts[k] || 0) + 1;
        boxAreas[k] = (boxAreas[k] || 0) + (b.box ? b.box.w * b.box.h : 0);
      });

      if (!candidates.length) {
        setError('No food recognized on-device — try a clearer shot or use Pick');
        return;
      }

      // Open the confirm/correct step. Nothing is logged until the user confirms.
      setPending({ candidates, photoUri: shot.uri, boxCounts, boxAreas });
      setConfirmOpen(true);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setScanning(false);
    }
  }

  // User picked (or corrected) the food in the confirm step.
  async function onConfirmFood(name) {
    setConfirmOpen(false);
    const photoUri = pending?.photoUri || null;
    const rawCount = pending?.boxCounts?.[name.toLowerCase()] || 0;
    const areaFrac = pending?.boxAreas?.[name.toLowerCase()] || 0;
    setPending(null);
    setScanning(true);
    setError(null);
    try {
      // Offline table first (zero network); if the confirmed name isn't there,
      // the user explicitly chose it, so a text-only USDA lookup is acceptable.
      let nutrition = getNutritionOffline(name);
      if (!nutrition) { try { nutrition = await getNutrition(name); } catch (_) {} }

      if (!nutrition) {
        setLastFood({
          name, queryName: name,
          recognizedBy: 'Confirmed by you',
          noNutrition: true, riskLevel: 'unknown',
          riskMessage: 'No nutrition data for this food',
          photoUri,
        });
        setScanToken(t => t + 1);
        setCardOpen(true);
        return;
      }

      nutrition.queryName = name;
      nutrition.recognizedBy = 'Confirmed by you';
      nutrition.photoUri = photoUri;

      // Portion model: typical serving (baseGrams) × detected count × size
      // multiplier. The multiplier is seeded from the detected box area, then the
      // user fine-tunes it in the card. Macros/GL recompute from the grams.
      const baseGrams = nutrition.portionGrams != null ? nutrition.portionGrams : 100;
      const count = Math.max(1, rawCount);
      const sizeMult = count > 1 ? 1 : seedMultFromArea(areaFrac);

      nutrition.baseGrams = baseGrams;
      nutrition.countDetected = count;
      nutrition.sizeMult = sizeMult;
      if (count > 1) nutrition.name = `${count} × ${nutrition.name}`;

      Object.assign(nutrition, applyPortion(nutrition, baseGrams * count * sizeMult));
      nutrition.portionLabel = portionLabelOf(nutrition);

      await loadFood(nutrition);
      setCardOpen(true);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setScanning(false);
    }
  }

  function onRescan() {
    setConfirmOpen(false);
    setPending(null);
    setTimeout(onScan, 250);
  }

  async function onPickFood(name) {
    setPickerOpen(false);
    setScanning(true);
    setError(null);
    try {
      let nutrition = null;
      try { nutrition = await getNutrition(name); } catch (_) {}
      if (!nutrition) nutrition = getNutritionOffline(name);
      if (!nutrition) throw new Error(`No data for "${name}"`);
      nutrition.queryName = name;
      nutrition.recognizedBy = 'Manual (PICK)';
      await loadFood(nutrition);
      setCardOpen(true);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setScanning(false);
    }
  }

  const q = filter.toLowerCase().trim();
  const visibleFoods = COMMON_FOODS.filter(f => f.includes(q));
  const showUsdaSearchRow = q.length >= 2 && !visibleFoods.includes(q);
  const risk = lastFood ? (RISK[lastFood.riskLevel] || RISK.safe) : null;
  const verdict = lastFood?.verdict ? VERDICT[lastFood.verdict] : null;
  const prof = PROFILES[profile];

  // Gate the whole app behind sign-in (accounts are local/on-device).
  if (booting) return <View style={styles.container} />;
  if (!authUser) return <Login onAuthed={onAuthed} />;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View ref={arViewRef} collapsable={false} style={styles.ar}>
        <ViroARSceneNavigator
          ref={navRef}
          autofocus={true}
          initialScene={{ scene: ARFoodScanScene }}
          viroAppProps={{ food: lastFood, scanToken }}
          style={styles.ar}
        />
      </View>

      {/* ---- Top summary bar ---- */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.summaryPill} onPress={() => setDashOpen(true)} activeOpacity={0.85}>
          <Ring size={42} stroke={5} progress={totals.calories / goal} color={totals.calories > goal ? C.red : C.cal}>
            <Text style={styles.ringMini}>{Math.round((totals.calories / goal) * 100)}</Text>
          </Ring>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.summaryKcal}>{Math.round(totals.calories)} <Text style={styles.summaryGoal}>/ {goal} kcal</Text></Text>
            <Text style={styles.summarySub}>{log.length} item{log.length === 1 ? '' : 's'} today</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.profileChip, { borderColor: prof.accent }]} onPress={() => setIntakeOpen(true)}>
          <Text style={styles.profileIcon}>{prof.icon}</Text>
          <Text style={[styles.profileText, { color: prof.accent }]}>{prof.label}</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Last-scan card (tap to open full nutrition) ---- */}
      {lastFood && !error && (
        <TouchableOpacity style={[styles.lastCard, verdict && { borderColor: verdict.color }]} onPress={() => setCardOpen(true)} activeOpacity={0.9}>
          <View style={[styles.lastDot, { backgroundColor: (verdict || risk).color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lastName} numberOfLines={1}>{lastFood.name}</Text>
            <Text style={styles.lastMeta}>
              {lastFood.caloriesPortion ?? lastFood.calories} kcal
              {lastFood.portionGrams ? ` · ${lastFood.portionGrams} g` : ''}
              {lastFood.gi != null ? ` · GI ${lastFood.gi}` : ''}
            </Text>
            {lastFood.recommendation ? (
              <Text style={styles.lastRec} numberOfLines={2}>{lastFood.recommendation}</Text>
            ) : null}
          </View>
          <Text style={[styles.lastRisk, { color: (verdict || risk).color }]}>{(verdict || risk).label}</Text>
        </TouchableOpacity>
      )}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
        </View>
      )}

      {/* ---- Floating chat buttons: Llama 3 (left) + rule engine (right) ---- */}
      <TouchableOpacity style={[styles.fab, styles.fabLeft]} onPress={() => setLlamaOpen(true)} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>🗨️</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.fab, styles.fabRight]} onPress={() => setRuleOpen(true)} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>

      {/* ---- Bottom action bar ---- */}
      <View style={styles.bottomBar}>
        <NavBtn icon="📊" label="Today" onPress={() => setDashOpen(true)} />
        <NavBtn icon="🍽" label="Pick" onPress={() => setPickerOpen(true)} disabled={scanning} />
        <TouchableOpacity style={[styles.scanBtn, scanning && { opacity: 0.6 }]} onPress={onScan} disabled={scanning} activeOpacity={0.85}>
          {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanIcon}>SCAN</Text>}
        </TouchableOpacity>
        <NavBtn icon="❤️" label="Health" onPress={() => setHealthOpen(true)} />
        <NavBtn icon="⚙️" label="Profile" onPress={() => setIntakeOpen(true)} />
      </View>

      {/* ---- Panels ---- */}
      <NutritionCard
        visible={cardOpen} food={lastFood} onClose={() => setCardOpen(false)}
        onFindNutrition={(name) => { setCardOpen(false); onPickFood(name); }}
        portionSteps={PORTION_STEPS}
        onPortionChange={changePortion}
      />
      <Dashboard
        visible={dashOpen} onClose={() => setDashOpen(false)}
        totals={totals} goal={goal} log={log} history={history}
        profileLabel={prof.label} onClear={clearLog}
      />
      <HealthPanel visible={healthOpen} onClose={() => setHealthOpen(false)} health={health} food={lastFood} onConnect={connectHealth} />
      {/* LEFT: local Llama 3 (grounded on the same app data). */}
      <ChatPanel
        visible={llamaOpen} onClose={() => setLlamaOpen(false)}
        side="left" title="🗨️ Llama 3" accent={C.teal}
        greeting={"Hi! I'm Llama 3 running locally — I answer in natural language, grounded on your own logged data. Ask me anything about your diet."}
        suggestions={SUGGESTIONS}
        checkAvailable={isLlamaAvailable}
        statusReady="🟢 Llama 3 · local PC"
        statusBusy="… connecting to local LLM"
        statusDown="⚪ Local LLM offline — start Ollama"
        respond={async (q, priorTurns) => {
          const ctx = { user, lastFood, totals, goal, log, history, health, profileLabel: prof.label };
          try {
            const text = await chatLlama([...priorTurns, { role: 'user', content: q }], buildFacts(ctx));
            return { text, source: 'Llama 3 · local' };
          } catch (_) {
            return {
              text: "I can't reach the local Llama 3 server. Make sure Ollama is running on the paired PC and the phone is connected over USB. Meanwhile, the 💬 rule-based assistant on the right works fully offline.",
              source: 'unavailable',
            };
          }
        }}
      />

      {/* RIGHT: rule-based engine — unchanged, fully offline. */}
      <ChatPanel
        visible={ruleOpen} onClose={() => setRuleOpen(false)}
        side="right" title="💬 Quick Assistant" accent={C.blue}
        greeting={"Hi! I'm your on-device assistant — instant, fully offline. Ask about your calories, macros, food log, last scan, trends, or wearable data."}
        suggestions={SUGGESTIONS}
        statusReady="On-device · rule engine"
        respond={async (q) => {
          const ctx = { user, lastFood, totals, goal, log, history, health, profileLabel: prof.label };
          return { text: answer(q, ctx).text, source: 'rule engine' };
        }}
      />
      <HealthIntake visible={intakeOpen} onClose={() => setIntakeOpen(false)} user={user} onSave={saveUser} username={authUser} onLogout={onLogout} region={region} onRegionChange={changeRegion} />
      <ConfirmFood
        visible={confirmOpen}
        candidates={pending?.candidates || []}
        photoUri={pending?.photoUri}
        searchList={SEARCH_FOODS}
        region={region}
        onRegionChange={changeRegion}
        onConfirm={onConfirmFood}
        onRescan={onRescan}
        onClose={() => { setConfirmOpen(false); setPending(null); }}
      />

      {/* ---- Pick-food modal ---- */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick a food</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}><Text style={styles.close}>✕</Text></TouchableOpacity>
            </View>
            <TextInput
              value={filter} onChangeText={setFilter}
              placeholder="Search foods..." placeholderTextColor={C.textFaint} style={styles.search}
            />
            <FlatList
              data={visibleFoods}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={showUsdaSearchRow ? (
                <TouchableOpacity style={[styles.foodRow, { backgroundColor: C.blue + '22' }]} onPress={() => onPickFood(filter.trim())}>
                  <Text style={[styles.foodRowText, { color: C.blue }]}>🔎 Search USDA for "{filter.trim()}"</Text>
                </TouchableOpacity>
              ) : null}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.foodRow} onPress={() => onPickFood(item)}>
                  <Text style={styles.foodRowText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NavBtn({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.navBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={styles.navLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  ar: { flex: 1 },

  topBar: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(14,17,22,0.82)', borderRadius: 30, paddingVertical: 6, paddingHorizontal: 8, paddingRight: 14,
    borderWidth: 1, borderColor: C.line,
  },
  ringMini:    { color: C.text, fontSize: 10, fontWeight: '800' },
  summaryKcal: { color: C.text, fontSize: 14, fontWeight: '800' },
  summaryGoal: { color: C.textDim, fontSize: 11, fontWeight: '600' },
  summarySub:  { color: C.textFaint, fontSize: 10, marginTop: 1 },
  profileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(14,17,22,0.82)', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1,
  },
  profileIcon: { fontSize: 14 },
  profileText: { fontSize: 12, fontWeight: '800' },

  lastCard: {
    position: 'absolute', left: 12, right: 12, bottom: 108,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(23,27,34,0.94)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.line,
  },
  lastDot:  { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  lastName: { color: C.text, fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  lastMeta: { color: C.textDim, fontSize: 12, marginTop: 2 },
  lastRec:  { color: C.textDim, fontSize: 11, marginTop: 4, lineHeight: 15 },
  lastRisk: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginLeft: 8, maxWidth: 70, textAlign: 'right' },

  errorCard: {
    position: 'absolute', left: 12, right: 12, bottom: 108,
    backgroundColor: 'rgba(248,97,122,0.16)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.red,
  },
  errorText: { color: '#FFB3BF', fontSize: 13, textAlign: 'center' },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingTop: 10, paddingBottom: 18, paddingHorizontal: 8,
    backgroundColor: 'rgba(14,17,22,0.92)', borderTopWidth: 1, borderTopColor: C.line,
  },
  fab:      { position: 'absolute', bottom: 110, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  fabLeft:  { left: 16, backgroundColor: C.teal },
  fabRight: { right: 16, backgroundColor: C.blue },
  fabIcon:  { fontSize: 24 },
  navBtn:   { alignItems: 'center', width: 60 },
  navIcon:  { fontSize: 20 },
  navLabel: { color: C.textDim, fontSize: 10, marginTop: 3, fontWeight: '600' },
  scanBtn:  { width: 70, height: 70, borderRadius: 35, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: -22, borderWidth: 4, borderColor: C.bg },
  scanIcon: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard:  { backgroundColor: C.bg, maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderTopWidth: 1, borderColor: C.line },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  close:      { color: C.textDim, fontSize: 22, paddingHorizontal: 8 },
  search:     { backgroundColor: C.surface2, color: C.text, borderRadius: 12, padding: 12, marginBottom: 10 },
  foodRow:    { paddingVertical: 13, borderBottomColor: C.line, borderBottomWidth: 1 },
  foodRowText:{ color: C.text, fontSize: 15, textTransform: 'capitalize' },
});
