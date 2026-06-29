import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Sheet } from './Sheet';
import { C } from './theme';
import { getNutritionOffline } from '../services/NutritionAPI';

// Multi-food (plate) confirm step. When the on-device box detector finds SEVERAL
// distinct foods on one plate, we no longer collapse them into a single wrong
// guess — we list each item separately, show ITS OWN calories, and let the user
// adjust counts / remove items / add a missed one. Each confirmed item is logged
// as its own entry, so the plate's calories break down per item.
function kcalOf(name, count) {
  const n = getNutritionOffline(name);
  if (!n) return null;
  const per = n.caloriesPortion != null ? n.caloriesPortion : n.calories;
  return Math.round((per || 0) * Math.max(1, count));
}

export function ConfirmPlate({ visible, onClose, items = [], photoUri, searchList = [], quickAdd = [], note, autoDetect, onConfirm, onRescan, onAiDetect, aiBusy }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const firedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setRows(items.map(it => ({ name: it.name, count: Math.max(1, it.count || 1), on: true })));
      setQ('');
    } else {
      firedRef.current = false; // allow auto-detect to fire again next open
    }
  }, [visible, items]);

  // Auto-run local-AI detection once when the builder opens for a mixed plate,
  // so items appear without the user hunting for the Smart-detect button.
  useEffect(() => {
    if (visible && autoDetect && onAiDetect && !firedRef.current) {
      firedRef.current = true;
      onAiDetect(true);
    }
  }, [visible, autoDetect]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.toLowerCase().trim();
  const matches = query.length >= 1 ? searchList.filter(f => f.includes(query)).slice(0, 10) : [];

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addItem = (name) => {
    setQ('');
    setRows(rs => {
      const k = rs.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
      if (k >= 0) return rs.map((r, j) => (j === k ? { ...r, on: true, count: r.count + 1 } : r));
      return [...rs, { name, count: 1, on: true }];
    });
  };

  const enabled = rows.filter(r => r.on);
  const total = enabled.reduce((a, r) => a + (kcalOf(r.name, r.count) || 0), 0);

  return (
    <Sheet visible={visible} onClose={onClose} title="Items on your plate" subtitle="Each food is counted separately" accent={C.blue}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
        {photoUri ? <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" /> : null}

        {note ? <Text style={s.note}>{note}</Text> : null}

        {onAiDetect && (
          <TouchableOpacity style={s.ai} onPress={() => onAiDetect(false)} disabled={aiBusy} activeOpacity={0.85}>
            {aiBusy
              ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><ActivityIndicator color={C.purple} /><Text style={[s.aiText, { marginLeft: 8 }]}>Detecting…</Text></View>
              : <Text style={s.aiText}>✨  Re-detect items with local AI</Text>}
          </TouchableOpacity>
        )}

        {/* Quick-add palette — tap each food on your plate (each logs separately) */}
        {quickAdd.length > 0 && (
          <>
            <Text style={s.section}>Tap each item on your plate</Text>
            <View style={s.chips}>
              {quickAdd.map(f => {
                const on = rows.some(r => r.name.toLowerCase() === f.toLowerCase() && r.on);
                return (
                  <TouchableOpacity key={f} style={[s.chip, on && s.chipOn]} onPress={() => addItem(f)} activeOpacity={0.8}>
                    <Text style={[s.chipText, on && { color: C.blue }]}>{on ? '✓ ' : '＋ '}{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>{enabled.length} item{enabled.length === 1 ? '' : 's'} selected</Text>
          <Text style={s.totalKcal}>{total} kcal total</Text>
        </View>

        {rows.map((r, i) => {
          const kc = kcalOf(r.name, r.count);
          return (
            <View key={`${r.name}-${i}`} style={[s.item, !r.on && s.itemOff]}>
              <TouchableOpacity style={s.check} onPress={() => setRow(i, { on: !r.on })} activeOpacity={0.8}>
                <Text style={[s.checkMark, r.on && { color: C.blue }]}>{r.on ? '☑' : '☐'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{r.name}</Text>
                <Text style={[s.itemKcal, kc == null && { color: C.amber }]}>
                  {kc != null ? `${kc} kcal${r.count > 1 ? ` · ${r.count} ×` : ''}` : 'no offline data — tap to swap below'}
                </Text>
              </View>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setRow(i, { count: Math.max(1, r.count - 1) })}><Text style={s.stepText}>−</Text></TouchableOpacity>
                <Text style={s.count}>{r.count}</Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setRow(i, { count: r.count + 1 })}><Text style={s.stepText}>＋</Text></TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={s.section}>Add a missed item</Text>
        <TextInput
          value={q} onChangeText={setQ}
          placeholder="Search a food to add…" placeholderTextColor={C.textFaint} style={s.search} autoCorrect={false}
        />
        {matches.map(f => (
          <TouchableOpacity key={f} style={s.searchRow} onPress={() => addItem(f)} activeOpacity={0.85}>
            <Text style={s.searchText}>{f}</Text>
            <Text style={s.pick}>＋</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[s.logBtn, !enabled.length && { opacity: 0.5 }]}
          disabled={!enabled.length}
          onPress={() => onConfirm(enabled.map(r => ({ name: r.name, count: r.count })))}
          activeOpacity={0.85}
        >
          <Text style={s.logText}>Log {enabled.length} item{enabled.length === 1 ? '' : 's'} · {total} kcal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.rescan} onPress={onRescan} activeOpacity={0.85}>
          <Text style={s.rescanText}>↻  Rescan</Text>
        </TouchableOpacity>
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  photo:    { width: '100%', height: 130, borderRadius: 16, marginBottom: 14, backgroundColor: C.surface2 },
  note:     { color: C.textDim, fontSize: 13, lineHeight: 19, marginBottom: 12, backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.line },
  ai:       { borderWidth: 1, borderColor: C.purple, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 14, backgroundColor: C.purple + '14' },
  aiText:   { color: C.purple, fontSize: 14, fontWeight: '800' },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip:     { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  chipOn:   { borderColor: C.blue, backgroundColor: C.blue + '22' },
  chipText: { color: C.textDim, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel:{ color: C.textDim, fontSize: 13, fontWeight: '700' },
  totalKcal:{ color: C.text, fontSize: 16, fontWeight: '900' },
  item:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  itemOff:  { opacity: 0.45 },
  check:    { paddingRight: 10 },
  checkMark:{ color: C.textDim, fontSize: 22 },
  itemName: { color: C.text, fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  itemKcal: { color: C.textDim, fontSize: 12, marginTop: 2 },
  stepper:  { flexDirection: 'row', alignItems: 'center' },
  stepBtn:  { width: 30, height: 30, borderRadius: 8, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  stepText: { color: C.text, fontSize: 18, fontWeight: '800' },
  count:    { color: C.text, fontSize: 15, fontWeight: '800', minWidth: 26, textAlign: 'center' },
  section:  { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },
  search:   { backgroundColor: C.surface2, color: C.text, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  searchRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  searchText:{ color: C.text, fontSize: 15, textTransform: 'capitalize' },
  pick:     { color: C.blue, fontSize: 22, fontWeight: '700', marginLeft: 4 },
  logBtn:   { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  logText:  { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.4 },
  rescan:   { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  rescanText:{ color: C.textDim, fontSize: 15, fontWeight: '700' },
});
