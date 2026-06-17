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
import { getNutrition, getNutritionOffline, OFFLINE_FOODS } from './src/services/NutritionAPI';
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

const LOG_KEY = 'ARDIET_LOG_V1';
const PROFILE_KEY = 'ARDIET_PROFILE_V1';   // legacy (focus only) — migrated to USER_KEY
const USER_KEY = 'ARDIET_USER_V1';

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

function mergeCandidates(boxes, cls, produce = []) {
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

// Scale per-100g macros to what was actually eaten.
function computeConsumed(food) {
  const g = food.portionGrams;
  const f = g != null ? g / 100 : 1;
  return {
    calories: food.caloriesPortion != null ? food.caloriesPortion : Math.round((food.calories || 0) * f),
    protein: Math.round((food.protein || 0) * f),
    carbs: Math.round((food.carbs || 0) * f),
    fat: Math.round((food.fat || 0) * f),
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
  const [log, setLog] = useState([]); // today's entries

  const [pickerOpen, setPickerOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [dashOpen, setDashOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(null); // { candidates, photoUri, boxCounts }
  const [filter, setFilter] = useState('');

  const profile = user?.focus || 'general';
  const goal = Number(user?.dailyGoal) || PROFILES[profile]?.goal || 2000;

  // ---- persistence ----
  useEffect(() => {
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem(USER_KEY);
        if (rawUser) {
          setUser({ ...EMPTY_USER, ...JSON.parse(rawUser) });
        } else {
          // migrate legacy focus-only profile
          const p = await AsyncStorage.getItem(PROFILE_KEY);
          if (p && PROFILES[p]) setUser({ ...EMPTY_USER, focus: p, dailyGoal: PROFILES[p].goal });
        }
        const raw = await AsyncStorage.getItem(LOG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.date === todayStr() && Array.isArray(parsed.items)) setLog(parsed.items);
        }
      } catch (_) {}
    })();
    getHealthMetrics().then(setHealth).catch(() => {});
  }, []);

  function persistLog(items) {
    AsyncStorage.setItem(LOG_KEY, JSON.stringify({ date: todayStr(), items })).catch(() => {});
  }
  function saveUser(next) {
    setUser(next);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
    if (lastFood && !lastFood.noNutrition) {
      // re-assess the currently shown food under the updated profile
      const assess = assessForUser(lastFood, health, next);
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
    const assess = assessForUser(nutrition, h, user);
    const food = { ...nutrition, ...assess, health: h };
    setLastFood(food);
    setScanToken(t => t + 1);

    const entry = {
      id: `${Date.now()}`,
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

  function clearLog() {
    setLog([]);
    persistLog([]);
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
      const candidates = mergeCandidates(boxes, cls, produce);
      const boxCounts = {};
      boxes.forEach(b => { const k = b.name.toLowerCase(); boxCounts[k] = (boxCounts[k] || 0) + 1; });

      if (!candidates.length) {
        setError('No food recognized on-device — try a clearer shot or use Pick');
        return;
      }

      // Open the confirm/correct step. Nothing is logged until the user confirms.
      setPending({ candidates, photoUri: shot.uri, boxCounts });
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
    const count = pending?.boxCounts?.[name.toLowerCase()] || 0;
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

      // Item count from the box detector: "3 × apple" scales the portion.
      if (count > 1 && nutrition.portionGrams != null) {
        nutrition.countDetected = count;
        nutrition.name = `${count} × ${nutrition.name}`;
        nutrition.portionGrams = nutrition.portionGrams * count;
        nutrition.caloriesPortion = Math.round((nutrition.calories || 0) * nutrition.portionGrams / 100);
        nutrition.portionLabel = `${count} items (~${nutrition.portionGrams} g)`;
      }

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
      />
      <Dashboard
        visible={dashOpen} onClose={() => setDashOpen(false)}
        totals={totals} goal={goal} log={log} profileLabel={prof.label} onClear={clearLog}
      />
      <HealthPanel visible={healthOpen} onClose={() => setHealthOpen(false)} health={health} food={lastFood} />
      <HealthIntake visible={intakeOpen} onClose={() => setIntakeOpen(false)} user={user} onSave={saveUser} />
      <ConfirmFood
        visible={confirmOpen}
        candidates={pending?.candidates || []}
        photoUri={pending?.photoUri}
        searchList={SEARCH_FOODS}
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
