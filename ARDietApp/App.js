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
  ScrollView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { captureRef } from 'react-native-view-shot';
import ARFoodScanScene from './src/scenes/ARFoodScanScene';
import { identifyFood } from './src/services/FoodRecognition';
import { getNutrition, getNutritionOffline } from './src/services/NutritionAPI';
import { computeRisk, suggestAlternative } from './src/engine/RiskEngine';
import { getHealthMetrics } from './src/services/HealthMetrics';
import { COMMON_FOODS } from './src/data/GlycemicIndex';

const RISK_COLORS = { safe: '#44CC44', caution: '#FFA500', danger: '#FF4444' };

async function requestStoragePermissions() {
  if (Platform.OS !== 'android') return;
  try {
    const sdk = Platform.Version;
    const perms = [];
    if (sdk >= 33) perms.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
    else perms.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    if (perms.length) await PermissionsAndroid.requestMultiple(perms);
  } catch (_) { /* non-fatal */ }
}

export default function App() {
  const navRef = useRef(null);
  const arViewRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [lastFood, setLastFood] = useState(null);
  const [error, setError] = useState(null);
  const [scanToken, setScanToken] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => { requestStoragePermissions(); }, []);

  async function loadFood(nutrition) {
    if (!nutrition) throw new Error('No nutrition data');
    const health = await getHealthMetrics().catch(() => null);
    const risk   = computeRisk(nutrition, health);
    const alt    = suggestAlternative(nutrition.queryName || nutrition.name, risk.riskLevel);
    setLastFood({ ...nutrition, ...risk, alternative: alt, health });
    setScanToken(t => t + 1);
  }

  async function onScan() {
    if (scanning) return;
    setScanning(true);
    setError(null);
    try {
      if (!arViewRef.current) {
        throw new Error('AR view not ready — wait a moment then retry');
      }

      // react-native-view-shot captures the rendered RN surface (camera + AR
      // overlays). Returns base64 directly — no file:// roundtrip needed.
      let base64;
      try {
        base64 = await captureRef(arViewRef, {
          format: 'jpg',
          quality: 0.5,
          result: 'base64',
        });
      } catch (e) {
        console.warn('captureRef failed', e);
        setError('Camera capture failed — opening PICK list');
        setPickerOpen(true);
        return;
      }
      if (!base64) {
        setError('Empty capture — opening PICK list');
        setPickerOpen(true);
        return;
      }

      let concepts;
      try {
        concepts = await identifyFood(base64);
      } catch (e) {
        throw new Error(`Vision API: ${e.message || e}`);
      }
      if (!concepts?.length) throw new Error('No food labels detected — try PICK instead');

      // try top 5 guesses in USDA until one returns nutrition data
      let nutrition = null;
      const tried = [];
      for (const c of concepts.slice(0, 5)) {
        tried.push(c.name);
        try { nutrition = await getNutrition(c.name); } catch (_) {}
        if (nutrition) { nutrition.queryName = c.name; break; }
      }
      // fall back to offline table on the same guesses
      if (!nutrition) {
        for (const name of tried) {
          nutrition = getNutritionOffline(name);
          if (nutrition) break;
        }
      }
      if (!nutrition) throw new Error(`No nutrition match for: ${tried.join(', ')}`);

      await loadFood(nutrition);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setScanning(false);
    }
  }

  async function onPickFood(name) {
    setPickerOpen(false);
    setScanning(true);
    setError(null);
    try {
      let nutrition = null;
      try { nutrition = await getNutrition(name); } catch (e) { /* fall through to offline */ }
      if (!nutrition) nutrition = getNutritionOffline(name);
      if (!nutrition) throw new Error(`No data for "${name}"`);
      nutrition.queryName = name;
      await loadFood(nutrition);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setScanning(false);
    }
  }

  const q = filter.toLowerCase().trim();
  const visibleFoods = COMMON_FOODS.filter(f => f.includes(q));
  const showUsdaSearchRow = q.length >= 2 && !visibleFoods.includes(q);

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

      <View style={styles.bottomBar}>
        {error ? (
          <Text style={styles.error} numberOfLines={2}>{error}</Text>
        ) : lastFood ? (
          <Text style={[styles.statusOk, { color: RISK_COLORS[lastFood.riskLevel] || '#fff' }]}>
            {lastFood.name} • {lastFood.calories} kcal
            {lastFood.gi != null ? ` • GI ${lastFood.gi}` : ''}
            {' • '}{lastFood.riskLevel.toUpperCase()}
          </Text>
        ) : (
          <Text style={styles.status}>Point at food then tap SCAN, or pick from list</Text>
        )}

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => setPickerOpen(true)}
            disabled={scanning}
          >
            <Text style={styles.btnTextSecondary}>PICK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, scanning && styles.btnDisabled]}
            onPress={onScan}
            disabled={scanning}
          >
            {scanning
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>SCAN</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, !lastFood && styles.btnDisabled]}
            onPress={() => setDetailsOpen(true)}
            disabled={!lastFood || scanning}
          >
            <Text style={styles.btnTextSecondary}>DETAILS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pick-food modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick a food</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search..."
              placeholderTextColor="#888"
              style={styles.search}
            />
            <FlatList
              data={visibleFoods}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={showUsdaSearchRow ? (
                <TouchableOpacity
                  style={[styles.foodRow, { backgroundColor: '#2E7BFF22' }]}
                  onPress={() => onPickFood(filter.trim())}
                >
                  <Text style={[styles.foodRowText, { color: '#7AB8FF' }]}>
                    🔎 Search USDA for "{filter.trim()}"
                  </Text>
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

      {/* Details modal */}
      <Modal visible={detailsOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{lastFood?.name}</Text>
              <TouchableOpacity onPress={() => setDetailsOpen(false)}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            {lastFood && (
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={[styles.riskCard, { borderColor: RISK_COLORS[lastFood.riskLevel] }]}>
                  <Text style={[styles.riskLevel, { color: RISK_COLORS[lastFood.riskLevel] }]}>
                    {lastFood.riskLevel.toUpperCase()} — {lastFood.riskMessage}
                  </Text>
                  {lastFood.diabetesFlag && (
                    <Text style={styles.diabetesFlag}>⚠ Diabetes-relevant: high glycemic load</Text>
                  )}
                  {lastFood.alternative && (
                    <Text style={styles.alt}>Healthier swap: {lastFood.alternative}</Text>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Nutrition (per 100 g)</Text>
                {[
                  ['Calories',       `${lastFood.calories} kcal`],
                  ['Protein',        `${lastFood.protein} g`],
                  ['Carbohydrates',  `${lastFood.carbs} g`],
                  ['  – Sugar',      `${lastFood.sugar} g`],
                  ['  – Fiber',      `${lastFood.fiber} g`],
                  ['Fat',            `${lastFood.fat} g`],
                  ['  – Saturated',  `${lastFood.saturatedFat} g`],
                  ['Sodium',         `${lastFood.sodium} mg`],
                  ['Cholesterol',    `${lastFood.cholesterol} mg`],
                  ['Potassium',      `${lastFood.potassium} mg`],
                  ['Calcium',        `${lastFood.calcium} mg`],
                  ['Iron',           `${lastFood.iron} mg`],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={styles.detailKey}>{k}</Text>
                    <Text style={styles.detailVal}>{v}</Text>
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Glycemic Index</Text>
                {lastFood.gi != null ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>GI value</Text>
                      <Text style={styles.detailVal}>{lastFood.gi}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Category</Text>
                      <Text style={styles.detailVal}>{lastFood.giCategory}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Source</Text>
                      <Text style={styles.detailVal}>{lastFood.giSource}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.detailKey}>Not in GI table</Text>
                )}

                <Text style={styles.sectionTitle}>Wearable / mHealth (Goal 2)</Text>
                {lastFood.health ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Source</Text>
                      <Text style={styles.detailVal}>{lastFood.health.source}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Resting HR</Text>
                      <Text style={styles.detailVal}>
                        {lastFood.health.restingHeartRate != null ? `${lastFood.health.restingHeartRate} bpm` : '—'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Steps today</Text>
                      <Text style={styles.detailVal}>
                        {lastFood.health.stepsToday != null ? lastFood.health.stepsToday : '—'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Sleep</Text>
                      <Text style={styles.detailVal}>
                        {lastFood.health.sleepHours != null ? `${lastFood.health.sleepHours} h` : '—'}
                      </Text>
                    </View>
                    {lastFood.reasons?.length > 0 && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailKey}>Risk reasons</Text>
                        <Text style={styles.detailVal}>{lastFood.reasons.join(', ')}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.detailKey}>No wearable data available</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  ar: { flex: 1 },
  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
  },
  status:    { color: '#ddd', marginBottom: 10, fontSize: 13 },
  statusOk:  { marginBottom: 10, fontSize: 13, fontWeight: '700' },
  error:     { color: '#FF7777', marginBottom: 10, fontSize: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, alignItems: 'center', minWidth: 90 },
  btnPrimary:     { backgroundColor: '#2E7BFF' },
  btnSecondary:   { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnDisabled:    { opacity: 0.4 },
  btnText:          { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  btnTextSecondary: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 1 },

  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard:  { backgroundColor: '#191A1F', maxHeight: '80%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  close:      { color: '#fff', fontSize: 22, paddingHorizontal: 8 },
  search:     { backgroundColor: '#2A2C33', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 10 },
  foodRow:    { paddingVertical: 12, borderBottomColor: '#2A2C33', borderBottomWidth: 1 },
  foodRowText:{ color: '#fff', fontSize: 15, textTransform: 'capitalize' },

  riskCard:   { borderWidth: 2, borderRadius: 10, padding: 12, marginBottom: 14 },
  riskLevel:  { fontSize: 15, fontWeight: '700' },
  diabetesFlag: { color: '#FFAA66', marginTop: 6, fontSize: 13 },
  alt:        { color: '#7CFFB2', marginTop: 6, fontSize: 13 },

  sectionTitle:{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  detailRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: '#23252B', borderBottomWidth: 1 },
  detailKey:  { color: '#bbb', fontSize: 14 },
  detailVal:  { color: '#fff', fontSize: 14, fontWeight: '600' },
});
