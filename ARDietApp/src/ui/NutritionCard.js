import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { Sheet } from './Sheet';
import { Ring, MacroRing } from './Ring';
import { C, RISK, VERDICT } from './theme';
import { glCategory } from '../services/NutritionAPI';

// rough per-meal reference targets for the macro rings
const MEAL = { protein: 40, carbs: 75, fat: 25 };

// "is this nutritious?" tone → color
const QUALITY_COLOR = { good: C.green, ok: C.teal, low: C.amber, poor: C.red };

export function NutritionCard({ visible, food, onClose, onFindNutrition, portionSteps = [0.5, 1, 1.5, 2], onPortionChange }) {
  const [expanded, setExpanded] = useState(false);
  if (!food) return null;

  const risk = RISK[food.riskLevel] || RISK.safe;
  const verdict = food.verdict ? VERDICT[food.verdict] : null;
  const accent = verdict ? verdict.color : risk.color;
  const kcal = food.caloriesPortion != null ? food.caloriesPortion : food.calories;
  const portionNote = food.portionGrams != null ? `${food.portionGrams} g portion` : 'per 100 g';
  const qColor = QUALITY_COLOR[food.qualityTone] || C.textDim;

  // Per-portion macros (scaled from the per-100g lookup). Glycemic LOAD reflects
  // the actual portion, unlike GI which is a per-food intensity.
  const pProtein = food.proteinPortion != null ? food.proteinPortion : food.protein;
  const pCarbs   = food.carbsPortion   != null ? food.carbsPortion   : food.carbs;
  const pFat     = food.fatPortion     != null ? food.fatPortion     : food.fat;
  const gl = food.glycemicLoad;
  const glCat = glCategory(gl);
  const sizeMult = food.sizeMult || 1;
  const showPortion = !!onPortionChange && food.baseGrams != null;

  // Recognized on-device, but no nutrition data available offline:
  // show what we saw + offer a user-triggered USDA text search.
  if (food.noNutrition) {
    return (
      <Sheet visible={visible} onClose={onClose} title={food.name} subtitle={food.recognizedBy} accent={risk.color}>
        {food.photoUri && <Image source={{ uri: food.photoUri }} style={s.photo} resizeMode="cover" />}
        <View style={[s.pill, { backgroundColor: risk.color + '22', borderColor: risk.color, marginBottom: 10 }]}>
          <Text style={[s.pillText, { color: risk.color }]}>{risk.label}</Text>
        </View>
        <Text style={s.riskMsg}>
          Recognized on your device, but this food isn't in the offline nutrition table.
        </Text>
        {food.alsoDetected?.length > 0 && (
          <Text style={[s.portion, { marginTop: 8 }]}>Other guesses: {food.alsoDetected.join(', ')}</Text>
        )}
        {onFindNutrition && (
          <TouchableOpacity
            style={s.usdaBtn}
            onPress={() => onFindNutrition(food.queryName || food.name)}
            activeOpacity={0.85}
          >
            <Text style={s.usdaBtnText}>Search USDA for "{food.queryName || food.name}"</Text>
            <Text style={s.usdaBtnNote}>sends only the food name — never the photo</Text>
          </TouchableOpacity>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={food.name} subtitle={food.recognizedBy} accent={accent}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        {/* the photo that was scanned (kept in app-private storage on the phone) */}
        {food.photoUri && <Image source={{ uri: food.photoUri }} style={s.photo} resizeMode="cover" />}

        {/* personalized verdict banner (recommendation engine) */}
        {verdict && (
          <View style={[s.verdict, { borderColor: verdict.color, backgroundColor: verdict.color + '1A' }]}>
            <Text style={[s.verdictLabel, { color: verdict.color }]}>{verdict.label}</Text>
            {food.recommendation ? <Text style={s.verdictRec}>{food.recommendation}</Text> : null}
          </View>
        )}

        {/* nutrition quality — "is this nourishing enough?" (separate from risk) */}
        {food.qualityLabel && (
          <View style={s.qualityRow}>
            <View style={[s.qualityDot, { backgroundColor: qColor }]} />
            <Text style={[s.qualityLabel, { color: qColor }]}>{food.qualityLabel}</Text>
            {food.qualityNote ? <Text style={s.qualityNote} numberOfLines={2}>{food.qualityNote}</Text> : null}
          </View>
        )}

        {/* allergy alert */}
        {food.allergens?.length > 0 && (
          <View style={[s.flag, { borderColor: C.red, backgroundColor: C.red + '1A' }]}>
            <Text style={[s.flagText, { color: C.red, fontWeight: '800' }]}>
              ⚠ Allergy alert: contains {food.allergens.join(', ')}
            </Text>
          </View>
        )}

        {/* hero: calorie ring + risk pill */}
        <View style={s.hero}>
          <Ring size={120} stroke={12} progress={kcal / 700} color={risk.color}>
            <Text style={s.kcal}>{kcal}</Text>
            <Text style={s.kcalUnit}>kcal</Text>
          </Ring>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <View style={[s.pill, { backgroundColor: risk.color + '22', borderColor: risk.color }]}>
              <Text style={[s.pillText, { color: risk.color }]}>{risk.label}</Text>
            </View>
            <Text style={s.riskMsg}>{food.riskMessage}</Text>
            <Text style={s.portion}>{portionNote}{food.portionLabel ? ` · ${food.portionLabel}` : ''}</Text>
            {(food.gi != null || gl != null) && (
              <View style={s.giRow}>
                {food.gi != null && <>
                  <Text style={s.giLabel}>GI</Text>
                  <Text style={s.giVal}>{food.gi}</Text>
                  <Text style={[s.giCat, giColor(food.giCategory)]}>{food.giCategory}</Text>
                </>}
                {gl != null && <>
                  <Text style={[s.giLabel, { marginLeft: 14 }]}>GL</Text>
                  <Text style={s.giVal}>{gl}</Text>
                  <Text style={[s.giCat, giColor(glCat)]}>{glCat}</Text>
                </>}
              </View>
            )}
          </View>
        </View>

        {/* portion adjuster — the image only estimates the portion; you confirm it */}
        {showPortion && (
          <View style={s.portionBox}>
            <View style={s.portionHead}>
              <Text style={s.portionTitle}>Portion</Text>
              <Text style={s.portionGrams}>{food.portionLabel || `${food.portionGrams} g`}</Text>
            </View>
            <View style={s.portionRow}>
              {portionSteps.map(m => (
                <TouchableOpacity key={m} style={[s.portionBtn, sizeMult === m && s.portionBtnActive]} onPress={() => onPortionChange(m)} activeOpacity={0.85}>
                  <Text style={[s.portionBtnText, sizeMult === m && s.portionBtnTextActive]}>{m}×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.portionNote}>
              Macros are looked up from a food database and scaled to this portion — adjust to match your plate.
            </Text>
          </View>
        )}

        {/* macro rings (this portion) */}
        <View style={s.macros}>
          <MacroRing label="Protein" grams={pProtein} goalGrams={MEAL.protein} color={C.protein} />
          <MacroRing label="Carbs"   grams={pCarbs}   goalGrams={MEAL.carbs}   color={C.carbs} />
          <MacroRing label="Fat"     grams={pFat}     goalGrams={MEAL.fat}     color={C.fat} />
        </View>

        {food.diabetesFlag && (
          <View style={[s.flag, { borderColor: C.purple }]}>
            <Text style={[s.flagText, { color: C.purple }]}>⚠ Diabetes-relevant: high glycemic load</Text>
          </View>
        )}

        {food.alternative && (
          <View style={[s.flag, { borderColor: C.green, backgroundColor: C.green + '14' }]}>
            <Text style={s.swapLabel}>Healthier swap</Text>
            <Text style={[s.flagText, { color: C.green, fontSize: 15 }]}>{food.alternative}</Text>
          </View>
        )}

        {/* summary vs expanded toggle (Goal 1) */}
        <TouchableOpacity style={s.toggle} onPress={() => setExpanded(e => !e)}>
          <Text style={s.toggleText}>{expanded ? 'Hide full nutrition ▲' : 'Show full nutrition ▼'}</Text>
        </TouchableOpacity>

        {expanded && (
          <View style={s.table}>
            {[
              ['Calories', `${food.calories} kcal /100g`],
              ['Protein', `${food.protein} g`],
              ['Carbohydrates', `${food.carbs} g`],
              ['  – Sugar', `${food.sugar} g`],
              ['  – Fiber', `${food.fiber} g`],
              ['Fat', `${food.fat} g`],
              ['  – Saturated', `${food.saturatedFat} g`],
              ['Sodium', `${food.sodium} mg`],
              ['Cholesterol', `${food.cholesterol} mg`],
              ['Potassium', `${food.potassium} mg`],
              ['Calcium', `${food.calcium} mg`],
              ['Iron', `${food.iron} mg`],
            ].map(([k, v]) => (
              <View key={k} style={s.row}>
                <Text style={s.rowK}>{k}</Text>
                <Text style={s.rowV}>{v}</Text>
              </View>
            ))}
            {food.alsoDetected?.length > 0 && (
              <View style={s.row}>
                <Text style={s.rowK}>Also detected</Text>
                <Text style={s.rowV}>{food.alsoDetected.join(', ')}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

function giColor(cat) {
  if (cat === 'high') return { color: C.red };
  if (cat === 'medium') return { color: C.amber };
  return { color: C.green };
}

const s = StyleSheet.create({
  photo:    { width: '100%', height: 150, borderRadius: 16, marginBottom: 14, backgroundColor: C.surface2 },
  verdict:  { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 12 },
  verdictLabel: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  verdictRec:   { color: C.text, fontSize: 13, lineHeight: 19, marginTop: 6 },
  qualityRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  qualityDot:  { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  qualityLabel:{ fontSize: 14, fontWeight: '800', marginRight: 8 },
  qualityNote: { color: C.textDim, fontSize: 12, flex: 1, minWidth: 160 },
  hero:     { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  kcal:     { color: C.text, fontSize: 30, fontWeight: '900' },
  kcalUnit: { color: C.textDim, fontSize: 12, marginTop: -2 },
  pill:     { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  riskMsg:  { color: C.text, fontSize: 15, fontWeight: '600' },
  portion:  { color: C.textDim, fontSize: 12, marginTop: 4 },
  giRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  giLabel:  { color: C.textFaint, fontSize: 12, fontWeight: '700', marginRight: 6 },
  giVal:    { color: C.text, fontSize: 16, fontWeight: '800', marginRight: 8 },
  giCat:    { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  portionBox:  { backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  portionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  portionTitle:{ color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  portionGrams:{ color: C.blue, fontSize: 14, fontWeight: '800' },
  portionRow:  { flexDirection: 'row', gap: 8 },
  portionBtn:  { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, alignItems: 'center' },
  portionBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  portionBtnText:   { color: C.textDim, fontSize: 14, fontWeight: '800' },
  portionBtnTextActive: { color: '#fff' },
  portionNote: { color: C.textFaint, fontSize: 11, marginTop: 10, lineHeight: 15 },
  macros:   { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.surface, borderRadius: 16, paddingVertical: 16, marginBottom: 14 },
  flag:     { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  flagText: { fontSize: 13, fontWeight: '600' },
  swapLabel:{ color: C.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  usdaBtn:  { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  usdaBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  usdaBtnNote: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  toggle:   { alignItems: 'center', paddingVertical: 12 },
  toggleText:{ color: C.blue, fontSize: 14, fontWeight: '700' },
  table:    { backgroundColor: C.surface, borderRadius: 16, padding: 14 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomColor: C.line, borderBottomWidth: 1 },
  rowK:     { color: C.textDim, fontSize: 14 },
  rowV:     { color: C.text, fontSize: 14, fontWeight: '600' },
});
