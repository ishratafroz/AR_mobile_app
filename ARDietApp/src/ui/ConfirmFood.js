import React, { useState, useEffect } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Sheet } from './Sheet';
import { C } from './theme';
import { REGIONS, regionFoods } from '../data/Cuisines';

// Common RAW foods the on-device dish classifier structurally can't name (its
// vocabulary is all prepared dishes), so we surface them as one-tap chips. These
// all resolve in the offline nutrition table.
const QUICK_FOODS = [
  'apple', 'banana', 'orange', 'grape', 'strawberry', 'mango', 'watermelon',
  'egg', 'rice', 'bread', 'salad',
];

// Confirm / correct step. On-device models are imperfect (and limited to their
// vocabulary), so instead of silently logging a wrong guess we show the top
// candidates + quick chips + a search box and let the user pick in one tap.
// A cuisine selector biases recognition and tailors the quick-pick chips so
// non-Western / less-popular regional dishes are one tap to log correctly.
export function ConfirmFood({ visible, onClose, candidates = [], photoUri, searchList = [], region = 'global', onRegionChange, onConfirm, onRescan }) {
  const [q, setQ] = useState('');

  useEffect(() => { if (visible) setQ(''); }, [visible]);

  const query = q.toLowerCase().trim();
  const matches = query.length >= 1
    ? searchList.filter(f => f.includes(query)).slice(0, 12)
    : [];

  // Region dishes first, then the raw-produce fallbacks (deduped).
  const quick = Array.from(new Set([...regionFoods(region), ...QUICK_FOODS]));

  return (
    <Sheet visible={visible} onClose={onClose} title="Is this right?" subtitle="Tap the correct food — or search" accent={C.blue}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
        {photoUri ? <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" /> : null}

        <Text style={s.section}>Cuisine</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.regionRow}>
          {REGIONS.map(r => {
            const active = r.key === region;
            return (
              <TouchableOpacity
                key={r.key}
                style={[s.region, active && s.regionActive]}
                onPress={() => onRegionChange && onRegionChange(r.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.regionText, active && s.regionTextActive]}>{r.icon} {r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.section}>Best guesses</Text>
        {candidates.length === 0 && <Text style={s.empty}>No on-device guess — search below.</Text>}
        {candidates.map((c, i) => (
          <TouchableOpacity key={`${c.name}-${i}`} style={[s.cand, i === 0 && s.candTop]} onPress={() => onConfirm(c.name)} activeOpacity={0.85}>
            <View style={{ flex: 1 }}>
              <Text style={s.candName}>{c.name}</Text>
              <Text style={[s.candMeta, !c.hasNutrition && { color: C.amber }]}>
                {c.score > 0 ? `${Math.round(c.score * 100)}% confidence` : 'alternative guess'}
                {c.hasNutrition ? ' · nutrition ready' : ' · no offline data'}
              </Text>
            </View>
            {i === 0 && <Text style={s.bestTag}>BEST</Text>}
            <Text style={s.pick}>＋</Text>
          </TouchableOpacity>
        ))}

        <Text style={s.section}>Quick pick</Text>
        <View style={s.chips}>
          {quick.map(f => (
            <TouchableOpacity key={f} style={s.chip} onPress={() => onConfirm(f)} activeOpacity={0.8}>
              <Text style={s.chipText}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.section}>Not listed? Search</Text>
        <TextInput
          value={q} onChangeText={setQ}
          placeholder="Type a food name…" placeholderTextColor={C.textFaint} style={s.search}
          autoCorrect={false}
        />
        {matches.map(f => (
          <TouchableOpacity key={f} style={s.searchRow} onPress={() => onConfirm(f)} activeOpacity={0.85}>
            <Text style={s.searchText}>{f}</Text>
            <Text style={s.pick}>＋</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.rescan} onPress={onRescan} activeOpacity={0.85}>
          <Text style={s.rescanText}>↻  Rescan</Text>
        </TouchableOpacity>
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  photo:    { width: '100%', height: 130, borderRadius: 16, marginBottom: 14, backgroundColor: C.surface2 },
  section:  { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },
  empty:    { color: C.textFaint, fontSize: 13, fontStyle: 'italic' },
  cand:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  candTop:  { borderColor: C.blue, backgroundColor: C.blue + '14' },
  candName: { color: C.text, fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  candMeta: { color: C.textDim, fontSize: 12, marginTop: 2 },
  bestTag:  { color: C.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginRight: 10 },
  pick:     { color: C.blue, fontSize: 22, fontWeight: '700', marginLeft: 4 },
  search:   { backgroundColor: C.surface2, color: C.text, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  searchRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  searchText:{ color: C.text, fontSize: 15, textTransform: 'capitalize' },
  regionRow:    { paddingVertical: 2, paddingRight: 8 },
  region:       { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  regionActive: { borderColor: C.blue, backgroundColor: C.blue + '22' },
  regionText:   { color: C.textDim, fontSize: 13, fontWeight: '600' },
  regionTextActive: { color: C.blue },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:     { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { color: C.textDim, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  rescan:   { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  rescanText:{ color: C.textDim, fontSize: 15, fontWeight: '700' },
});
